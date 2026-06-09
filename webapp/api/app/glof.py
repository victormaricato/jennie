"""GLOF expert-label lookup (read-only SQLite)."""
from __future__ import annotations

import sqlite3
from functools import lru_cache

from . import config


@lru_cache(maxsize=1)
def _con() -> sqlite3.Connection:
    # check_same_thread=False: FastAPI may call from a threadpool; reads only.
    return sqlite3.connect(config.GLOF_DB, check_same_thread=False)


def lookup(gene: str, aa_pos: int, ref_aa: str, alt_aa: str) -> dict | None:
    """Return the expert GLOF record for this variant, or None if not curated."""
    try:
        row = _con().execute(
            "SELECT label, variantkey FROM glof "
            "WHERE gene=? AND aa_pos=? AND ref_aa=? AND alt_aa=?",
            (gene.upper(), int(aa_pos), ref_aa.upper(), alt_aa.upper()),
        ).fetchone()
    except sqlite3.Error:
        return None
    if not row:
        return None
    return {"label": row[0], "variantkey": row[1]}


def lookup_by_variantkey(variantkey: str) -> dict | None:
    """Return the expert GLOF record for a genomic key 'chrom-pos-ref-alt'."""
    try:
        row = _con().execute(
            "SELECT label, gene FROM glof WHERE variantkey=?",
            (variantkey,),
        ).fetchone()
    except sqlite3.Error:
        return None
    if not row:
        return None
    return {"label": row[0], "gene": row[1], "variantkey": variantkey}
