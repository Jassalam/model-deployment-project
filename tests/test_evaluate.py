import math

import numpy as np

from src.evaluate import segment_metrics


def test_segment_metrics_split_by_duration_and_distance():
    y_true = np.array([10.0, 20.0, 90.0, 120.0])
    y_pred = np.array([10.0, 22.0, 60.0, 100.0])
    distance = np.array([1.0, 3.0, 15.0, 30.0])
    m = segment_metrics(y_true, y_pred, distance)

    assert math.isclose(m["rmse_val_le60min"], math.sqrt((0 + 4) / 2))
    assert math.isclose(m["rmse_val_gt60min"], math.sqrt((900 + 400) / 2))
    assert m["bias_val_gt60min"] == -25.0           # long trips under-predicted
    assert m["rmse_val_dist_0_2mi"] == 0.0
    assert math.isclose(m["rmse_val_dist_2_5mi"], 2.0)
    assert math.isnan(m["rmse_val_dist_5_10mi"])      # empty bin -> NaN, not a crash
    assert math.isclose(m["rmse_val"], math.sqrt((0 + 4 + 900 + 400) / 4))
