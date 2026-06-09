"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { lookupGenomic, GLOF_PAPER_URL, type GenomicHit } from "@/lib/api";

const CLASS_COLOR: Record<string, string> = {
  LOF: "var(--lof)", GOF: "var(--gof)", NEUTRAL: "var(--neutral-cls)",
};

/** Parse VCF text -> genomic keys "chrom-pos-ref-alt" (GRCh38, no chr prefix). */
function parseVcf(text: string): string[] {
  const keys: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length < 5) continue;
    const chrom = f[0].replace(/^chr/i, "");
    const pos = f[1];
    const ref = f[3];
    for (const alt of f[4].split(",")) {
      if (ref && alt && alt !== ".") keys.push(`${chrom}-${pos}-${ref}-${alt}`);
    }
  }
  return keys;
}

export function VcfLookup() {
  const [hits, setHits] = useState<GenomicHit[] | null>(null);
  const [summary, setSummary] = useState<{ matched: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null); setHits(null); setSummary(null); setBusy(true);
    try {
      const keys = parseVcf(await file.text());
      if (keys.length === 0) throw new Error("no variant records found in the VCF");
      const capped = keys.slice(0, 2000);
      const res = await lookupGenomic(capped);
      setHits(res.hits.filter((h) => h.label));   // show matches first
      setSummary({ matched: res.n_matched, total: keys.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch lookup from a VCF</CardTitle>
        <CardDescription>
          Upload a VCF (GRCh38) to look its variants up against the{" "}
          <a href={GLOF_PAPER_URL} target="_blank" rel="noreferrer"
             className="underline underline-offset-2 hover:text-foreground">GLOF</a>{" "}
          expert benchmark by genomic coordinate. Matched variants return their
          curated LOF/GOF/NEUTRAL label. (Novel genomic variants are not
          classified here: that needs genomic&rarr;protein annotation; use the
          gene or sequence input above for those.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors w-fit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload .vcf
          <input type="file" accept=".vcf,.txt" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </label>

        {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

        {summary && (
          <p className="text-sm text-muted-foreground">
            {summary.matched} of {summary.total} variants found in GLOF.
            {summary.total > 2000 && " (first 2000 looked up)"}
          </p>
        )}

        {hits && hits.length > 0 && (
          <div className="rounded-md border divide-y max-h-80 overflow-auto">
            {hits.map((h) => (
              <div key={h.variantkey} className="flex items-center justify-between px-3 py-1.5 text-sm">
                <code className="text-xs text-muted-foreground">{h.variantkey}</code>
                <div className="flex items-center gap-3">
                  {h.gene && <span className="text-xs text-muted-foreground">{h.gene}</span>}
                  <span className="font-semibold tabular-nums" style={{ color: CLASS_COLOR[h.label || "NEUTRAL"] }}>
                    {h.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {hits && hits.length === 0 && summary && (
          <p className="text-sm text-muted-foreground">None of the VCF variants are in GLOF.</p>
        )}
      </CardContent>
    </Card>
  );
}
