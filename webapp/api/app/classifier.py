"""Supervised LOF/GOF/NEUTRAL classifier.

Pipeline: mean-pooled ESM-2 embedding of the wild-type sequence, concatenated
with the mean-pooled embedding of the mutated sequence, fed to a
gradient-boosted 3-class classifier. The wild-type embedding is cached per
sequence, so scoring many variants in one protein only pays for the alt
embedding each time. Direction (GOF vs LOF) AUROC is about 0.76 on held-out
genes under gene-disjoint cross-validation.
"""
from __future__ import annotations

from functools import lru_cache

import joblib
import numpy as np
import torch

from . import cache, config

torch.set_num_threads(config.TORCH_NUM_THREADS)
AA20 = set("ACDEFGHIKLMNPQRSTVWY")


@lru_cache(maxsize=1)
def _classifier():
    return joblib.load(config.CLASSIFIER_PATH)


@lru_cache(maxsize=1)
def _esm():
    from transformers import AutoTokenizer, EsmModel
    tok = AutoTokenizer.from_pretrained(config.ESM_MODEL_NAME)
    model = EsmModel.from_pretrained(config.ESM_MODEL_NAME).eval()
    return tok, model


def _mean_embedding(sequence: str) -> np.ndarray:
    cached = cache.get_embedding(sequence)
    if cached is not None:
        return cached
    tok, model = _esm()
    inputs = tok(sequence, return_tensors="pt", truncation=True,
                 max_length=config.MAX_SEQUENCE_LENGTH, padding=False)
    with torch.no_grad():
        out = model(**inputs, output_hidden_states=True)
        emb = out.hidden_states[-1].mean(dim=1).squeeze(0).cpu().numpy()
    emb = emb.astype(np.float32)
    cache.set_embedding(sequence, emb)
    return emb


def _apply(sequence: str, pos: int, alt: str) -> str:
    chars = list(sequence)
    chars[pos - 1] = alt
    return "".join(chars)


def classify(sequence: str, pos: int, alt: str) -> dict:
    """Return {label, probabilities} for a single missense substitution."""
    ref_emb = _mean_embedding(sequence)
    alt_emb = _mean_embedding(_apply(sequence, pos, alt))
    features = np.concatenate([ref_emb, alt_emb])
    proba = _classifier().predict_proba([features])[0]
    idx = int(np.argmax(proba))
    return {
        "label": config.LABELS[idx],
        "probabilities": {config.LABELS[i]: float(proba[i])
                          for i in range(len(config.LABELS))},
    }
