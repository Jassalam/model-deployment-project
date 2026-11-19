"""Validation metrics, overall and by segment, so a good average can't hide bad long trips."""

import numpy as np
import pandas as pd
from sklearn.metrics import root_mean_squared_error

DISTANCE_BINS = [0, 2, 5, 10, 20, 100]  # miles


def _rmse(y, p) -> float:
    return float(root_mean_squared_error(y, p)) if len(y) else float("nan")


def segment_metrics(y_true, y_pred, distance, prefix: str = "val") -> dict[str, float]:
    """RMSE overall, for trips <=60 / >60 min, and per distance bin; plus mean bias."""
    y_true, y_pred, distance = map(np.asarray, (y_true, y_pred, distance))
    m = {
        f"rmse_{prefix}": _rmse(y_true, y_pred),
        f"bias_{prefix}": float(np.mean(y_pred - y_true)),
    }
    short = y_true <= 60
    m[f"rmse_{prefix}_le60min"] = _rmse(y_true[short], y_pred[short])
    m[f"rmse_{prefix}_gt60min"] = _rmse(y_true[~short], y_pred[~short])
    m[f"bias_{prefix}_gt60min"] = (
        float(np.mean(y_pred[~short] - y_true[~short])) if (~short).any() else float("nan")
    )
    bins = pd.cut(distance, DISTANCE_BINS)
    for interval in bins.categories:
        sel = np.asarray(bins == interval)
        m[f"rmse_{prefix}_dist_{interval.left:g}_{interval.right:g}mi"] = _rmse(y_true[sel], y_pred[sel])
    return m
