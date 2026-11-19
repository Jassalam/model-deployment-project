import numpy as np
import pandas as pd
import pytest
import skops.io as sio
from sklearn.ensemble import RandomForestRegressor

from src.features import prepare_features


def make_trips(n: int = 200, seed: int = 0) -> pd.DataFrame:
    """Synthetic raw trips where duration grows with distance."""
    rng = np.random.default_rng(seed)
    pickup = pd.Timestamp("2025-01-10") + pd.to_timedelta(rng.integers(0, 86_400 * 5, n), unit="s")
    distance = rng.uniform(0.5, 15, n)
    duration = 3 + 3 * distance + rng.normal(0, 1, n)
    return pd.DataFrame({
        "tpep_pickup_datetime": pickup,
        "tpep_dropoff_datetime": pickup + pd.to_timedelta(duration, unit="min"),
        "PULocationID": rng.integers(1, 266, n).astype("int32"),
        "DOLocationID": rng.integers(1, 266, n).astype("int32"),
        "trip_distance": distance,
        "passenger_count": rng.choice([1.0, 2.0, np.nan], n),
        "duration": duration,
    })


@pytest.fixture
def trips() -> pd.DataFrame:
    return make_trips()


@pytest.fixture
def tiny_model_path(tmp_path, trips):
    """A small forest saved with skops, the same way training saves the real one."""
    model = RandomForestRegressor(n_estimators=5, max_depth=5, random_state=0)
    model.fit(prepare_features(trips), trips["duration"])
    path = tmp_path / "model.skops"
    sio.dump(model, path)
    return path
