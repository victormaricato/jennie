"""Build the GLOF expert-label lookup SQLite.

For variants already in the expert-curated GLOF benchmark we return the
ground-truth label (LOF / GOF / NEUTRAL) directly, with no model inference.
The lookup key is (gene_symbol, aa_position, ref_aa, alt_aa); ref/alt amino
acids are derived from PROTEIN_REF / PROTEIN_ALT at AA_POSITION.

Usage:
    python build_glof_lookup.py \
        --tsv /path/to/glof_dataset_20260401.tsv \
        --out app/data/glof_lookup.sqlite
"""
from __future__ import annotations

import argparse
import pathlib
import sqlite3

import pandas as pd

DEFAULT_TSV = ("/Users/victormaricato/Documents/Research/lof-gof-predictor/"
               "data/glof_dataset_20260401.tsv")


def ref_alt(row) -> tuple[str | None, str | None]:
    try:
        i = int(row["AA_POSITION"]) - 1
        ref = row["PROTEIN_REF"][i]
        alt = row["PROTEIN_ALT"][i]
        return ref, alt
    except Exception:
        return None, None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tsv", default=DEFAULT_TSV)
    ap.add_argument("--out", default="app/data/glof_lookup.sqlite")
    args = ap.parse_args()

    df = pd.read_csv(args.tsv, sep="\t")
    df[["ref_aa", "alt_aa"]] = df.apply(ref_alt, axis=1, result_type="expand")
    df = df.dropna(subset=["ref_aa", "alt_aa", "GENE_SYMBOL", "AA_POSITION"])
    df["gene"] = df["GENE_SYMBOL"].astype(str).str.upper()
    df["aa_pos"] = df["AA_POSITION"].astype(int)
    df = df[["gene", "aa_pos", "ref_aa", "alt_aa", "LABEL", "VARIANTKEY"]]
    df = df.drop_duplicates(subset=["gene", "aa_pos", "ref_aa", "alt_aa"])

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    con = sqlite3.connect(out)
    con.execute(
        "CREATE TABLE glof ("
        " gene TEXT, aa_pos INTEGER, ref_aa TEXT, alt_aa TEXT,"
        " label TEXT, variantkey TEXT,"
        " PRIMARY KEY (gene, aa_pos, ref_aa, alt_aa))"
    )
    con.executemany(
        "INSERT OR REPLACE INTO glof VALUES (?,?,?,?,?,?)",
        df.itertuples(index=False, name=None),
    )
    # Index on the genomic VARIANTKEY (chrom-pos-ref-alt) for VCF batch lookup.
    con.execute("CREATE INDEX IF NOT EXISTS idx_variantkey ON glof(variantkey)")
    con.commit()
    n = con.execute("SELECT COUNT(*) FROM glof").fetchone()[0]
    by_label = dict(con.execute("SELECT label, COUNT(*) FROM glof GROUP BY label").fetchall())
    con.close()
    print(f"wrote {out} with {n:,} variants")
    print(f"  by label: {by_label}")


if __name__ == "__main__":
    main()
