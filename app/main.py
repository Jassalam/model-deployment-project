"""FastAPI app serving NYC taxi trip-duration predictions.

Run: uv run uvicorn app.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pandas as pd
from fastapi import FastAPI

from app.schemas import Prediction, Trip
from src.model import MODEL_PATH, load_model, predict

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load once at startup, not per request (the forest is ~240 MB).
    state["model"] = load_model()
    mtime = datetime.fromtimestamp(MODEL_PATH.stat().st_mtime, tz=timezone.utc)
    state["version"] = f"rf-{mtime:%Y%m%d%H%M%S}"
    yield
    state.clear()


app = FastAPI(title="NYC Taxi Trip Duration", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model_loaded": "model" in state}


@app.post("/predict", response_model=Prediction)
def predict_duration(trip: Trip) -> Prediction:
    df = pd.DataFrame([trip.model_dump()])
    minutes = predict(state["model"], df)[0]
    return Prediction(duration_minutes=round(minutes, 2), model_version=state["version"])
