"use client";

import { useEffect, useState } from "react";

// Friendly, jargon-free progress labels that advance on a timer to give a
// sense of motion during scoring (incl. a cold-start model wake-up). The last
// label holds until the result arrives.
const LABELS = [
  "Loading models",
  "Reading the variant",
  "Annotating variant",
  "Scoring mechanism",
  "Almost there",
];

export function LoadingLabel({ active }: { active: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) {
      setI(0);
      return;
    }
    const t = setInterval(
      () => setI((prev) => Math.min(prev + 1, LABELS.length - 1)),
      2600,
    );
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      {LABELS[i]}
      <span className="inline-block w-4 text-left">{".".repeat((i % 3) + 1)}</span>
    </span>
  );
}
