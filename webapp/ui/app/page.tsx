"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { ResultCard } from "@/components/result-card";
import { VcfLookup } from "@/components/vcf-lookup";
import { JennieLogo } from "@/components/jennie-logo";
import { LoadingLabel } from "@/components/loading-label";
import { predict, GLOF_PAPER_URL, type Prediction, type Progress } from "@/lib/api";
import { cn } from "@/lib/utils";

function GlofLink({ href = GLOF_PAPER_URL, className }: { href?: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className={cn("underline underline-offset-2 hover:text-foreground", className)}>
      GLOF
    </a>
  );
}

const EXAMPLES = [
  { gene: "KCNJ11", variant: "V290M", note: "canonical LOF" },
  { gene: "KCNJ11", variant: "R201C", note: "canonical GOF" },
  { gene: "TP53", variant: "R175H", note: "hotspot" },
];

// Short, real protein fragments for the raw-sequence mode (ref residue at the
// example position matches, so they score without a reference-mismatch error).
const SEQ_EXAMPLES = [
  {
    name: "KCNJ11 (N-terminal fragment)",
    variant: "V13A",
    seq: "MLSRKGIIPEEYVLTRLAEDPAEPRYRARQRRARFVSKKGNCNVAHKNIREQGRFLQDVFTTLVDLKWPHTLLIFTMSFLCSWLLFAMAW",
  },
];

/** Parse a FASTA string -> the first record's sequence (residues only). */
function parseFasta(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let started = false;
  for (const line of lines) {
    if (line.startsWith(">")) {
      if (started) break; // only the first record
      started = true;
      continue;
    }
    if (line.trim()) out.push(line.trim());
  }
  // If no header was present, treat the whole thing as a bare sequence.
  const body = started ? out.join("") : lines.join("");
  return body.replace(/[^A-Za-z]/g, "").toUpperCase();
}

export default function Home() {
  const [mode, setMode] = useState<"gene" | "sequence">("gene");
  const [gene, setGene] = useState("");
  const [sequence, setSequence] = useState("");
  const [variant, setVariant] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy =
    progress != null &&
    progress.phase !== "done" &&
    progress.phase !== "error";

  async function onSubmit() {
    setError(null);
    setResult(null);
    try {
      const body =
        mode === "gene"
          ? { gene: gene.trim(), variant: variant.trim() }
          : { sequence: sequence.trim(), variant: variant.trim() };
      const pred = await predict(body, setProgress);
      setResult(pred);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <JennieLogo className="size-6" />
            JENNIE
          </div>
          <div className="flex items-center gap-1 text-sm">
            <a
              className="text-muted-foreground hover:text-foreground px-2"
              href="https://github.com/victormaricato/jennie"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Missense variant mechanism
          </h1>
          <p className="text-muted-foreground text-sm max-w-prose">
            Predict whether a missense variant is{" "}
            <span style={{ color: "var(--lof)" }} className="font-medium">loss-of-function</span>,{" "}
            <span style={{ color: "var(--gof)" }} className="font-medium">gain-of-function</span>, or{" "}
            neutral, using a classifier trained on{" "}
            <GlofLink /> (direction AUROC ~0.76 on held-out genes; mechanism
            prediction is hard, see the paper).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Score a variant</CardTitle>
            <CardDescription>
              Enter a gene symbol and a protein substitution, or paste a sequence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex rounded-md border p-0.5 text-sm">
              {(["gene", "sequence"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1 rounded-[0.3rem] transition-colors",
                    mode === m ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "gene" ? "Gene + variant" : "Raw sequence"}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              {mode === "gene" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="gene">Gene symbol</Label>
                  <Input id="gene" placeholder="KCNJ11" value={gene}
                         onChange={(e) => setGene(e.target.value)} />
                </div>
              ) : (
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="seq">Protein sequence</Label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                      <Upload className="size-3.5" />
                      Upload FASTA
                      <input
                        type="file"
                        accept=".fasta,.fa,.faa,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) setSequence(parseFasta(await file.text()));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  <Textarea id="seq" rows={3} placeholder="Paste a sequence or FASTA, or upload a .fasta file"
                            value={sequence}
                            onChange={(e) => setSequence(parseFasta(e.target.value))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="variant">Variant</Label>
                <Input id="variant" placeholder="V290M" value={variant}
                       className="sm:w-32"
                       onChange={(e) => setVariant(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Examples:</span>
              {mode === "gene"
                ? EXAMPLES.map((ex) => (
                    <button
                      key={`${ex.gene}-${ex.variant}`}
                      onClick={() => { setGene(ex.gene); setVariant(ex.variant); }}
                      className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent transition-colors"
                    >
                      {ex.gene} {ex.variant} <span className="text-muted-foreground">· {ex.note}</span>
                    </button>
                  ))
                : SEQ_EXAMPLES.map((ex) => (
                    <button
                      key={ex.name}
                      onClick={() => { setSequence(ex.seq); setVariant(ex.variant); }}
                      className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent transition-colors"
                    >
                      {ex.name} {ex.variant}
                    </button>
                  ))}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={onSubmit} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Score variant
              </Button>
              <LoadingLabel active={busy} />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>
            )}
          </CardContent>
        </Card>

        {result && <ResultCard prediction={result} />}

        <VcfLookup />

        <p className="text-xs text-muted-foreground text-center pt-4">
          Zero-shot foundation-model likelihoods predict pathogenicity but not
          direction; this tool uses the supervised classifier that does, trained
          and evaluated on the <GlofLink /> benchmark. See the{" "}
          <a className="underline" href="https://github.com/victormaricato/jennie" target="_blank" rel="noreferrer">JENNIE repo</a>.
        </p>
      </main>
    </div>
  );
}
