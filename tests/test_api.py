import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

SAMPLE = json.loads(Path("sample-request.json").read_text())


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
