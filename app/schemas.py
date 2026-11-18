from datetime import datetime

from pydantic import BaseModel, Field


class Trip(BaseModel):
    """Fields known when a taxi trip starts."""

    PULocationID: int = Field(ge=1, le=265, examples=[161], description="Pickup TLC zone ID")
    DOLocationID: int = Field(ge=1, le=265, examples=[236], description="Dropoff TLC zone ID")
    trip_distance: float = Field(gt=0, le=100, examples=[2.5], description="Miles")
    passenger_count: int | None = Field(default=None, ge=0, le=9, examples=[1])
    tpep_pickup_datetime: datetime = Field(examples=["2025-01-27T08:30:00"])


class Prediction(BaseModel):
    duration_minutes: float
    model_version: str
