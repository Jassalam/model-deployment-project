import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from src.paths import PROJECT_ROOT

SAMPLE = json.loads((PROJECT_ROOT / "sample-request.json").read_text())


@pytest.fixture
def client(monkeypatch, tiny_model_path):
    monkeypatch.setenv("MODEL_PATH", str(tiny_model_path))
    with TestClient(app) as c:  # `with` runs the startup hook that loads the model
        yield c


def test_health(client):
    assert client.get("/health").json() == {"status": "ok", "model_loaded": True}


def test_predict_sample_request(client):
    r = client.post("/predict", json=SAMPLE)
    assert r.status_code == 200
    body = r.json()
    assert body["duration_minutes"] > 0
    assert body["model_version"].startswith("rf-")


def test_passenger_count_is_optional(client):
    payload = {k: v for k, v in SAMPLE.items() if k != "passenger_count"}
    assert client.post("/predict", json=payload).status_code == 200


@pytest.mark.parametrize("field,value", [
    ("PULocationID", 999),
    ("DOLocationID", 0),
    ("trip_distance", -1),
    ("trip_distance", 0),
    ("passenger_count", 20),
    ("tpep_pickup_datetime", "not-a-date"),
])
def test_invalid_input_rejected(client, field, value):
    r = client.post("/predict", json={**SAMPLE, field: value})
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"][-1] == field


def test_missing_required_field_rejected(client):
    payload = {k: v for k, v in SAMPLE.items() if k != "trip_distance"}
    assert client.post("/predict", json=payload).status_code == 422


# --- Review fix 2.1: time zones -------------------------------------------------

def test_utc_pickup_is_converted_to_new_york_time(client):
    """08:30 UTC is 03:30 in New York (EST, UTC-5), so both must predict the same."""
    def pred(ts):
        r = client.post("/predict", json={**SAMPLE, "tpep_pickup_datetime": ts})
        assert r.status_code == 200
        return r.json()["duration_minutes"]

    nyc_local = pred("2025-01-27T03:30:00")
    assert pred("2025-01-27T08:30:00Z") == nyc_local
    assert pred("2025-01-27T03:30:00-05:00") == nyc_local
    assert pred(1737966600) == nyc_local  # Unix timestamp for 2025-01-27 08:30 UTC


# --- Review fix 2.6: date-only input -------------------------------------------

@pytest.mark.parametrize("value", ["2025-01-27", " 2025-01-27 "])
def test_date_without_time_rejected(client, value):
    r = client.post("/predict", json={**SAMPLE, "tpep_pickup_datetime": value})
    assert r.status_code == 422
    assert "must include a time" in r.json()["detail"][0]["msg"]
