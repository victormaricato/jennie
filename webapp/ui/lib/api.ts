// Client for the JENNIE backend: submit a variant, poll the queue if needed.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// GLOF is the benchmark (a separate dataset/paper); JENNIE is this tool.
// Data/label mentions link to the HF dataset; methodology mentions to the paper.
export const GLOF_HF_URL = "https://huggingface.co/datasets/victormaricato/glof";
export const GLOF_PAPER_URL =
  "https://www.biorxiv.org/content/10.64898/2026.06.05.729843v1";
// Back-compat default used by older call sites (methodology link).
export const GLOF_URL = GLOF_PAPER_URL;

export type GenomicHit = { variantkey: string; label: string | null; gene: string | null };

export async function lookupGenomic(variantkeys: string[]): Promise<{
  hits: GenomicHit[]; n_matched: number; n_total: number;
}> {
  const res = await fetch(`${API_BASE}/lookup_genomic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantkeys }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `lookup failed (${res.status})`);
  }
  return res.json();
}

export type Prediction = {
  label: "LOF" | "GOF" | "NEUTRAL";
  probabilities: Record<string, number>;
  variant: string;
  gene: string | null;
  source: "glof_expert" | "cache" | "model";
  note?: string | null;
};

type SubmitResponse = {
  status: "done" | "queued";
  result?: Prediction;
  job_id?: string;
  position?: number;
};

type ResultResponse = {
  status: "queued" | "running" | "done" | "error";
  result?: Prediction;
  position?: number;
  error?: string;
};

export type Progress =
  | { phase: "submitting" }
  | { phase: "waking" }
  | { phase: "queued"; position?: number }
  | { phase: "running" }
  | { phase: "done"; result: Prediction }
  | { phase: "error"; message: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The backend is a free HF Space that sleeps when idle; the first request
// after sleep can fail at the network layer while it wakes. Retry the submit
// a few times with backoff before giving up, surfacing a "waking" state.
async function submitWithWake(
  body: object,
  onProgress?: (p: Progress) => void,
): Promise<SubmitResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429) throw new Error("rate limit reached, try again in a minute");
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        // 5xx during wake-up: retry; 4xx: real client error, stop.
        if (res.status >= 500 && attempt < 5) { onProgress?.({ phase: "waking" }); await sleep(5000); continue; }
        throw new Error(detail.detail || `request failed (${res.status})`);
      }
      return res.json();
    } catch (e) {
      lastErr = e;
      // Network-level failure (sleeping Space): wait and retry.
      if (attempt < 5) { onProgress?.({ phase: "waking" }); await sleep(5000); continue; }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("could not reach the model server");
}

export async function predict(
  body: { variant: string; gene?: string; sequence?: string },
  onProgress?: (p: Progress) => void,
): Promise<Prediction> {
  onProgress?.({ phase: "submitting" });
  const submit = await submitWithWake(body, onProgress);

  if (submit.status === "done" && submit.result) {
    onProgress?.({ phase: "done", result: submit.result });
    return submit.result;
  }

  // Queued: poll /result until done.
  const jobId = submit.job_id!;
  onProgress?.({ phase: "queued", position: submit.position });
  for (let i = 0; i < 240; i++) {
    await sleep(1500);
    const r = await fetch(`${API_BASE}/result/${jobId}`);
    const data: ResultResponse = await r.json();
    if (data.status === "done" && data.result) {
      onProgress?.({ phase: "done", result: data.result });
      return data.result;
    }
    if (data.status === "error") {
      throw new Error(data.error || "scoring failed");
    }
    if (data.status === "running") onProgress?.({ phase: "running" });
    else onProgress?.({ phase: "queued", position: data.position });
  }
  throw new Error("timed out waiting for the model server");
}
