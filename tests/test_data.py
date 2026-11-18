import pandas as pd

from src.data import MAX_DURATION, MIN_DURATION, SPLIT_DATE, clean, split


def _raw(pickup, minutes, distance):
    pickup = pd.Timestamp(pickup)
    return {
        "tpep_pickup_datetime": pickup,
        "tpep_dropoff_datetime": pickup + pd.Timedelta(minutes=minutes),
        "PULocationID": 1, "DOLocationID": 2,
        "trip_distance": distance, "passenger_count": 1.0,
    }


def test_clean_computes_duration_in_minutes():
    out = clean(pd.DataFrame([_raw("2025-01-10 08:00", 12.5, 2.0)]))
    assert out["duration"].tolist() == [12.5]


def test_clean_drops_implausible_trips():
    rows = [
        _raw("2025-01-10 08:00", 10, 2.0),    # keep
        _raw("2025-01-10 08:00", 0.5, 2.0),   # too short
        _raw("2025-01-10 08:00", 61, 2.0),    # too long
        _raw("2025-01-10 08:00", -5, 2.0),    # negative duration
        _raw("2025-01-10 08:00", 10, 0.0),    # zero distance
        _raw("2025-01-10 08:00", 10, 500.0),  # absurd distance
        _raw("2024-12-31 23:00", 10, 2.0),    # outside January
        _raw("2025-02-01 00:10", 10, 2.0),    # outside January
    ]
    out = clean(pd.DataFrame(rows))
    assert len(out) == 1
    assert out["duration"].between(MIN_DURATION, MAX_DURATION).all()


def test_split_is_by_time_with_no_overlap(trips):
    early = trips.assign(tpep_pickup_datetime=pd.Timestamp("2025-01-10"))
    late = trips.assign(tpep_pickup_datetime=pd.Timestamp("2025-01-28"))
    train, val = split(pd.concat([early, late], ignore_index=True))
    assert len(train) == len(early) and len(val) == len(late)
    assert train["tpep_pickup_datetime"].max() < SPLIT_DATE <= val["tpep_pickup_datetime"].min()
