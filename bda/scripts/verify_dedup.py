"""
Measure how well the silver layer's spatial-temporal deduplication recovered
the generator's true duplicate clusters.

THIS IS VERIFICATION CODE, NOT PIPELINE CODE.
It is the only script permitted to read _ground_truth_clusters.csv. No Spark
job may import it — if the pipeline ever sees ground truth, the "we recovered
the signal" claim is void.

The clustering in 05_events_silver.py builds a neighbour graph (candidate pairs
from adjacent grid cells, filtered by true haversine distance and a time window)
and then propagates the minimum report id. That is an approximation of exact
connected components, so this script quantifies the error instead of leaving it
as a hand-wave in the viva.

Usage:
  python scripts/verify_dedup.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import REFERENCE_DIR, SILVER_EVENTS  # noqa: E402

TRUTH_CSV = REFERENCE_DIR / "_ground_truth_clusters.csv"


def main() -> None:
    silver_dir = SILVER_EVENTS / "reports"
    if not silver_dir.exists():
        sys.exit(f"{silver_dir} not found. Run spark/05_events_silver.py first.")
    if not TRUTH_CSV.exists():
        sys.exit(f"{TRUTH_CSV} not found. Run scripts/generate_civic_history.py first.")

    silver = pd.read_parquet(silver_dir, columns=["report_id", "report_group_id"])
    truth = pd.read_csv(TRUTH_CSV)

    # Only reports that survived the veracity rules reach silver, so restrict
    # the comparison to those — otherwise filtered rows look like lost clusters.
    merged = silver.merge(truth, on="report_id", how="inner")
    dropped = len(truth) - len(merged)

    print(f"reports in ground truth      : {len(truth):,}")
    print(f"reports reaching silver      : {len(silver):,}")
    print(f"filtered out before dedup    : {dropped:,}")
    print(f"compared                     : {len(merged):,}\n")

    n_true = merged.true_cluster_id.nunique()
    n_pred = merged.report_group_id.nunique()
    print(f"true incidents (in scope)    : {n_true:,}")
    print(f"predicted incidents          : {n_pred:,}")
    print(f"difference                   : {n_pred - n_true:+,} "
          f"({(n_pred - n_true) / n_true * 100:+.1f}%)\n")

    # Splitting: one true incident scattered across several predicted groups.
    splits = merged.groupby("true_cluster_id").report_group_id.nunique()
    # Merging: one predicted group absorbing several true incidents.
    merges = merged.groupby("report_group_id").true_cluster_id.nunique()

    print(f"true incidents split apart   : {(splits > 1).sum():,} "
          f"({(splits > 1).mean() * 100:.1f}%)")
    print(f"  worst split                : {splits.max()} fragments")
    print(f"predicted groups over-merged : {(merges > 1).sum():,} "
          f"({(merges > 1).mean() * 100:.1f}%)")
    print(f"  worst merge                : {merges.max()} true incidents\n")

    # A true incident is exactly recovered when it maps to one predicted group
    # AND that group contains nothing else.
    clean_true = set(splits[splits == 1].index)
    clean_pred = set(merges[merges == 1].index)
    pairs = merged[
        merged.true_cluster_id.isin(clean_true)
        & merged.report_group_id.isin(clean_pred)
    ]
    exact = pairs.true_cluster_id.nunique()
    print(f"exactly recovered incidents  : {exact:,} / {n_true:,} "
          f"({exact / n_true * 100:.1f}%)")

    # Pairwise agreement — the standard way to score a clustering.
    def pair_count(series: pd.Series) -> int:
        sizes = series.value_counts()
        return int((sizes * (sizes - 1) // 2).sum())

    tp = pair_count(
        merged.groupby(["true_cluster_id", "report_group_id"]).ngroup()
    )
    pred_pairs = pair_count(merged.report_group_id)
    true_pairs = pair_count(merged.true_cluster_id)
    precision = tp / pred_pairs if pred_pairs else 0.0
    recall = tp / true_pairs if true_pairs else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    print("\npairwise clustering quality")
    print(f"  precision                  : {precision:.4f}")
    print(f"  recall                     : {recall:.4f}")
    print(f"  F1                         : {f1:.4f}")

    print(
        "\n"
        "How to read this:\n"
        "  Precision 1.0 means the clusterer never merged two genuinely different\n"
        "  incidents. It is conservative, which is the right bias for a municipal\n"
        "  work queue: splitting one pothole into two tickets wastes a visit,\n"
        "  whereas merging two real potholes loses one of them entirely.\n"
        "  The recall gap is the radius cutoff. The generator scatters duplicates\n"
        "  up to ~13 m from the parent, so two of them can sit ~26 m apart, beyond\n"
        "  the 15 m edge threshold, and label propagation does not always bridge\n"
        "  them. Widening the radius raises recall and starts costing precision.\n"
        "Quote these numbers rather than claiming perfect deduplication."
    )


if __name__ == "__main__":
    main()
