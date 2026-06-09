"""JENNIE variant-mechanism API.

Flow for POST /predict:
  1. Resolve to (sequence, pos, ref, alt). gene -> UniProt sequence (cached).
  2. Validate the reference residue.
  3. GLOF expert-label lookup  -> return ground truth immediately.
  4. Redis result cache        -> return cached model prediction.
  5. Otherwise enqueue an RQ job and return {status: queued, job_id, position}.

GET /result/{job_id} polls a queued job (status + queue position + result).
"""
from __future__ import annotations

import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from rq import Queue
from rq.job import Job
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import cache, config, glof, uniprot
from .models import (GenomicHit, GenomicLookupRequest, GenomicLookupResponse,
                     Prediction, PredictRequest, ResultResponse, SubmitResponse)
from .tasks import run_prediction

AA20 = set("ACDEFGHIKLMNPQRSTVWY")
VARIANT_RE = re.compile(r"^([A-Z])(\d+)([A-Z])$")

limiter = Limiter(key_func=get_remote_address, default_limits=[])
app = FastAPI(title="JENNIE variant-mechanism API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if config.CORS_ORIGINS == "*" else config.CORS_ORIGINS.split(","),
    allow_methods=["*"], allow_headers=["*"], allow_credentials=False,
)

_redis = cache._r if cache.have_redis() else None
_queue = Queue(config.QUEUE_NAME, connection=_redis) if _redis else None


def _resolve(req: PredictRequest):
    """Return (sequence, pos, ref, alt, gene) or raise HTTPException(400)."""
    m = VARIANT_RE.match(req.variant.strip().upper())
    if not m:
        raise HTTPException(400, "variant must look like 'V290M' (ref, position, alt)")
    ref, pos, alt = m.group(1), int(m.group(2)), m.group(3)
    if ref not in AA20 or alt not in AA20:
        raise HTTPException(400, f"invalid amino acid in '{req.variant}'")

    gene = req.gene.strip().upper() if req.gene else None
    if req.sequence:
        sequence = req.sequence.strip().upper().replace(" ", "").replace("\n", "")
    else:
        resolved = uniprot.resolve_sequence(gene)
        if not resolved:
            raise HTTPException(404, f"could not resolve a reviewed human sequence for gene '{gene}'")
        sequence = resolved[1]

    if pos < 1 or pos > len(sequence):
        raise HTTPException(400, f"position {pos} out of range (sequence length {len(sequence)})")
    if sequence[pos - 1] != ref:
        raise HTTPException(400, f"reference mismatch: variant says {ref}{pos} but "
                                 f"sequence has {sequence[pos - 1]} at position {pos}")
    return sequence, pos, ref, alt, gene


@app.get("/health")
def health():
    return {"status": "ok", "model": config.ESM_MODEL_NAME,
            "redis": cache.have_redis(), "queue": _queue is not None}


@app.post("/predict", response_model=SubmitResponse)
@limiter.limit(config.RATE_LIMIT)
def predict(request: Request, payload: PredictRequest):
    sequence, pos, ref, alt, gene = _resolve(payload)
    variant = f"{ref}{pos}{alt}"

    # 1. GLOF expert ground truth (only when we know the gene).
    if gene:
        hit = glof.lookup(gene, pos, ref, alt)
        if hit:
            return SubmitResponse(status="done", result=Prediction(
                label=hit["label"], probabilities={hit["label"]: 1.0},
                variant=variant, gene=gene, source="glof_expert",
                note=f"Expert-curated label from the GLOF benchmark "
                     f"(variant {hit['variantkey']}). Not a model prediction."))

    # 2. Result cache.
    cached = cache.get_result(sequence, pos, alt)
    if cached:
        cached["gene"] = gene
        cached["source"] = "cache"
        return SubmitResponse(status="done", result=Prediction(**cached))

    # 3. Enqueue (or, without Redis, run inline).
    if _queue is None:
        result = run_prediction(sequence, pos, alt, variant, gene)
        return SubmitResponse(status="done", result=Prediction(**result))

    job = _queue.enqueue(run_prediction, sequence, pos, alt, variant, gene,
                         job_timeout=config.JOB_TIMEOUT,
                         result_ttl=config.JOB_RESULT_TTL)
    return SubmitResponse(status="queued", job_id=job.id,
                          position=_queue.count)


@app.post("/lookup_genomic", response_model=GenomicLookupResponse)
@limiter.limit(config.RATE_LIMIT)
def lookup_genomic(request: Request, payload: GenomicLookupRequest):
    """Batch VCF lookup: match genomic variants against GLOF expert labels.

    Pure lookup (no model). Variants not in GLOF return label=None; classifying
    a novel genomic variant would require genomic->protein annotation (VEP),
    which is out of scope for this tool.
    """
    hits: list[GenomicHit] = []
    matched = 0
    for vk in payload.variantkeys[:2000]:
        vk = vk.strip()
        rec = glof.lookup_by_variantkey(vk)
        if rec:
            matched += 1
            hits.append(GenomicHit(variantkey=vk, label=rec["label"], gene=rec["gene"]))
        else:
            hits.append(GenomicHit(variantkey=vk, label=None, gene=None))
    return GenomicLookupResponse(hits=hits, n_matched=matched,
                                 n_total=len(payload.variantkeys))


@app.get("/result/{job_id}", response_model=ResultResponse)
def result(job_id: str):
    if _queue is None:
        raise HTTPException(404, "no queue configured")
    try:
        job = Job.fetch(job_id, connection=_redis)
    except Exception:
        raise HTTPException(404, "unknown job_id")

    status = job.get_status()
    if status == "finished":
        return ResultResponse(status="done", result=Prediction(**job.result))
    if status == "failed":
        return ResultResponse(status="error", error=str(job.exc_info or "job failed"))
    if status == "started":
        return ResultResponse(status="running")
    # queued: report position in the pending queue.
    try:
        pos = _queue.get_job_ids().index(job_id) + 1
    except ValueError:
        pos = None
    return ResultResponse(status="queued", position=pos)
