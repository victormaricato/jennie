"""Redis-backed caches: prediction results, ESM-2 embeddings, gene sequences.

All keys are namespaced. Embeddings are stored as raw float32 bytes; results
and gene sequences as JSON. Falls back to a no-op in-process dict if Redis is
unreachable, so the API still works (just without cross-process caching) in
local dev.
"""
from __future__ import annotations

import hashlib
import json

import numpy as np

from . import config

try:
    import redis
    _r = redis.Redis.from_url(config.REDIS_URL)
    _r.ping()
    _HAVE_REDIS = True
except Exception:
    _r = None
    _HAVE_REDIS = False
    _fallback: dict[str, bytes] = {}


def _get(key: str) -> bytes | None:
    if _HAVE_REDIS:
        return _r.get(key)
    return _fallback.get(key)


def _set(key: str, value: bytes, ttl: int | None = None) -> None:
    if _HAVE_REDIS:
        _r.set(key, value, ex=ttl)
    else:
        _fallback[key] = value


def seq_hash(sequence: str) -> str:
    return hashlib.sha256(sequence.encode()).hexdigest()[:32]


# ---- prediction result cache ----

def _result_key(sequence: str, pos: int, alt: str) -> str:
    return f"res:{seq_hash(sequence)}:{pos}:{alt}"


def get_result(sequence: str, pos: int, alt: str) -> dict | None:
    raw = _get(_result_key(sequence, pos, alt))
    return json.loads(raw) if raw else None


def set_result(sequence: str, pos: int, alt: str, result: dict) -> None:
    _set(_result_key(sequence, pos, alt), json.dumps(result).encode(),
         config.RESULT_TTL_SECONDS)


# ---- ESM-2 mean-embedding cache (the expensive artifact) ----

def get_embedding(sequence: str) -> np.ndarray | None:
    raw = _get(f"emb:{seq_hash(sequence)}")
    return np.frombuffer(raw, dtype=np.float32) if raw else None


def set_embedding(sequence: str, emb: np.ndarray) -> None:
    _set(f"emb:{seq_hash(sequence)}", emb.astype(np.float32).tobytes(),
         config.EMBED_TTL_SECONDS)


# ---- gene -> sequence cache ----

def get_gene_sequence(gene: str) -> dict | None:
    raw = _get(f"gene:{gene.upper()}")
    return json.loads(raw) if raw else None


def set_gene_sequence(gene: str, payload: dict) -> None:
    _set(f"gene:{gene.upper()}", json.dumps(payload).encode(),
         config.EMBED_TTL_SECONDS)


def have_redis() -> bool:
    return _HAVE_REDIS
