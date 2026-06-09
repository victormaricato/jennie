import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GLOF_URL, type Prediction } from "@/lib/api";
import { FlaskConical, Database, Zap } from "lucide-react";

const CLASS_META: Record<string, { color: string; label: string; blurb: string }> = {
  LOF: { color: "var(--lof)", label: "Loss of function", blurb: "the variant reduces or abolishes protein activity" },
  GOF: { color: "var(--gof)", label: "Gain of function", blurb: "the variant increases or alters protein activity" },
  NEUTRAL: { color: "var(--neutral-cls)", label: "Neutral", blurb: "no predicted functional change" },
};

const SOURCE_META: Record<string, { icon: typeof FlaskConical; text: string; glof?: boolean }> = {
  glof_expert: { icon: Database, text: "Expert-curated label", glof: true },
  cache: { icon: Zap, text: "Cached model prediction" },
  model: { icon: FlaskConical, text: "Supervised ESM-2 + LightGBM" },
};

export function ResultCard({ prediction }: { prediction: Prediction }) {
  const meta = CLASS_META[prediction.label] ?? CLASS_META.NEUTRAL;
  const source = SOURCE_META[prediction.source] ?? SOURCE_META.model;
  const SourceIcon = source.icon;
  const order = ["LOF", "GOF", "NEUTRAL"];

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          {prediction.source !== "model" ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <SourceIcon className="size-3.5" />
              <span>
                {source.text}
                {source.glof && (
                  <>
                    {" ("}
                    <a href={GLOF_URL} target="_blank" rel="noreferrer"
                       className="underline underline-offset-2 hover:text-foreground">GLOF</a>
                    {" benchmark)"}
                  </>
                )}
              </span>
            </div>
          ) : <span />}
          <code className="text-xs text-muted-foreground">
            {prediction.gene ? `${prediction.gene} ` : ""}{prediction.variant}
          </code>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight" style={{ color: meta.color }}>
            {prediction.label}
          </span>
          <span className="text-sm text-muted-foreground">{meta.label}</span>
        </div>
        <p className="text-sm text-muted-foreground">{meta.blurb}.</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {order.map((cls) => {
          const p = prediction.probabilities[cls] ?? 0;
          return (
            <div key={cls} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={cn("font-medium", cls === prediction.label && "font-semibold")}>{cls}</span>
                <span className="tabular-nums text-muted-foreground">{(p * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(p * 100, 1)}%`, background: CLASS_META[cls].color }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
