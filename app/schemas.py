import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# A bare date such as "2025-01-27" would otherwise be parsed as midnight.
_DATE_ONLY = re.compile(r"^\s*\d{4}-\d{2}-\d{2}\s*$")


class Trip(BaseModel):
    """Fields known when a taxi trip starts."""

    PULocationID: int = Field(ge=1, le=265, examples=[161], description="Pickup TLC zone ID")
    DOLocationID: int = Field(ge=1, le=265, examples=[236], description="Dropoff TLC zone ID")
    trip_distance: float = Field(gt=0, le=100, examples=[2.5], description="Miles")
    passenger_count: int | None = Field(default=None, ge=0, le=9, examples=[1])
    tpep_pickup_datetime: datetime = Field(
        examples=["2025-01-27T08:30:00"],
        description="Pickup date and time. Without a time zone it is read as New York local "
                    "time; with one (e.g. 'Z' for UTC) it is converted to New York time.",
    )

    @field_validator("tpep_pickup_datetime", mode="before")
    @classmethod
    def require_time(cls, v):
        if isinstance(v, str) and _DATE_ONLY.match(v):
            raise ValueError("must include a time, e.g. '2025-01-27T08:30:00'")
        return v


class Prediction(BaseModel):
    duration_minutes: float
    model_version: str
