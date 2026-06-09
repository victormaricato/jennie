"""Gene symbol -> canonical UniProt protein sequence, cached in Redis.

Resolution is two REST calls (search for the reviewed human accession, then
fetch its sequence). Both the gene->accession and accession->sequence results
are cached so a popular gene resolves once.
"""
from __future__ import annotations

import requests

from . import cache, config

_SEARCH = "https://rest.uniprot.org/uniprotkb/search"


def resolve_sequence(gene: str) -> tuple[str, str] | None:
    """Return (uniprot_accession, sequence) for a human gene symbol, or None."""
    gene = gene.strip().upper()
    if not gene:
        return None

    cached = cache.get_gene_sequence(gene)
    if cached:
        return cached["accession"], cached["sequence"]

    query = f"gene_exact:{gene} AND organism_id:9606 AND reviewed:true"
    try:
        r = requests.get(
            _SEARCH,
            params={"query": query, "format": "json",
                    "fields": "accession,sequence", "size": "1"},
            timeout=config.UNIPROT_TIMEOUT,
        )
        r.raise_for_status()
        results = r.json().get("results", [])
    except Exception:
        return None
    if not results:
        return None

    acc = results[0].get("primaryAccession")
    seq = results[0].get("sequence", {}).get("value")
    if not acc or not seq:
        return None

    cache.set_gene_sequence(gene, {"accession": acc, "sequence": seq})
    return acc, seq
