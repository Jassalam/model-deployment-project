import pytest
from sklearn.metrics import root_mean_squared_error

from src.model import DEFAULT_MODEL_PATH, load_model, model_path, predict


def test_load_and_predict(tiny_model_path, trips):
    model = load_model(tiny_model_path)
    preds = predict(model, trips)
    assert len(preds) == len(trips)
    assert all(isinstance(p, float) for p in preds)


def test_model_learns_signal(tiny_model_path, trips):
    preds = predict(load_model(tiny_model_path), trips)
    # Synthetic durations span ~5-50 min; a model that learned anything beats 5 min RMSE.
    assert root_mean_squared_error(trips["duration"], preds) < 5


def test_missing_model_gives_clear_error(tmp_path):
    with pytest.raises(FileNotFoundError, match="src.train"):
        load_model(tmp_path / "nope.skops")


def test_model_path_env_override(monkeypatch, tmp_path):
    monkeypatch.delenv("MODEL_PATH", raising=False)
    assert model_path() == DEFAULT_MODEL_PATH
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "m.skops"))
    assert model_path() == tmp_path / "m.skops"


@pytest.mark.skipif(not DEFAULT_MODEL_PATH.exists(), reason="trained model not present")
def test_real_model_longer_trip_takes_longer():
    import pandas as pd

    base = {"tpep_pickup_datetime": "2025-01-27T14:00:00", "PULocationID": 161,
            "DOLocationID": 236, "passenger_count": 1}
    df = pd.DataFrame([{**base, "trip_distance": 1.0}, {**base, "trip_distance": 8.0}])
    short, long = predict(load_model(), df)
    assert 1 <= short < long <= 60
