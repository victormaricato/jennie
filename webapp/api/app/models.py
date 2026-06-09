"""Pydantic request/response schemas."""
from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel, Field, model_validator


class PredictRequest(BaseModel):
    """Either (gene + variant) or (sequence + variant).

    gene resolves to a UniProt sequence server-side and enables the GLOF
    expert-label lookup; sequence is the escape hatch for proteins not in
    UniProt or for custom constructs.
    """
    variant: str = Field(..., description="Substitution like 'V290M' (ref, 1-based pos, alt)")
    gene: Optional[str] = Field(None, description="HGNC gene symbol, e.g. KCNJ11")
    sequence: Optional[str] = Field(None, description="Raw protein sequence (overrides gene)")

    @model_validator(mode="after")
    def _need_one(self):
        if not self.gene and not self.sequence:
            raise ValueError("provide either 'gene' or 'sequence'")
        return self


class Prediction(BaseModel):
    label: str
    probabilities: Dict[str, float]
    variant: str
    gene: Optional[str] = None
    source: str  # "glof_expert" | "cache" | "model"
    note: Optional[str] = None


class SubmitResponse(BaseModel):
    status: str                       # "done" | "queued"
    result: Optional[Prediction] = None
    job_id: Optional[str] = None
    position: Optional[int] = None    # queue position when status == "queued"


class ResultResponse(BaseModel):
    status: str                       # "queued" | "running" | "done" | "error"
    result: Optional[Prediction] = None
    position: Optional[int] = None
    error: Optional[str] = None


class GenomicLookupRequest(BaseModel):
    """Batch genomic (VCF) lookup against the GLOF expert benchmark.

    Each key is 'chrom-pos-ref-alt' on GRCh38 with no 'chr' prefix, matching
    GLOF's VARIANTKEY convention.
    """
    variantkeys: list[str] = Field(..., max_length=2000)


class GenomicHit(BaseModel):
    variantkey: str
    label: Optional[str] = None   # None = not in GLOF
    gene: Optional[str] = None


class GenomicLookupResponse(BaseModel):
    hits: list[GenomicHit]
    n_matched: int
    n_total: int
