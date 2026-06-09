"""The unit of work the RQ worker runs: classify one variant and cache it.

Kept import-light at module top so the web process can enqueue this function
by reference without importing torch; the heavy imports live inside classify().
"""
from __future__ import annotations

from . import cache


def run_prediction(sequence: str, pos: int, alt: str, variant: str,
                   gene: str | None) -> dict:
    """Worker entrypoint. Returns a Prediction-shaped dict and caches it."""
    from .classifier import classify  # heavy import, worker-side only

    cached = cache.get_result(sequence, pos, alt)
    if cached:
        return cached

    pred = classify(sequence, pos, alt)
    result = {
        "label": pred["label"],
        "probabilities": pred["probabilities"],
        "variant": variant,
        "gene": gene,
        "source": "model",
        "note": ("Supervised ESM-2 + gradient-boosted classifier trained on GLOF. "
                 "Direction (GOF vs LOF) AUROC is about 0.76 on held-out genes "
                 "under gene-disjoint cross-validation; treat the direction call "
                 "as a weak prior."),
    }
    cache.set_result(sequence, pos, alt, result)
    return result
