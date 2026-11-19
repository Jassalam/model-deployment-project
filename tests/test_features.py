import numpy as np
import pandas as pd

from src.features import FEATURES, prepare_features


def test_columns_and_order(trips):
    X = prepare_features(trips)
    assert list(X.columns) == FEATURES
    assert len(X) == len(trips)
    assert not X.isna().any().any()


def test_missing_passenger_count_filled_with_one():
    df = pd.DataFrame({
        "tpep_pickup_datetime": ["2025-01-27T08:30:00"],
        "PULocationID": [161], "DOLocationID": [236],
        "trip_distance": [2.5], "passenger_count": [np.nan],
    })
    assert prepare_features(df)["passenger_count"].iloc[0] == 1


def test_time_features_from_pickup():
    df = pd.DataFrame({
        "tpep_pickup_datetime": ["2025-01-27T08:30:00"],  # a Monday
        "PULocationID": [161], "DOLocationID": [236],
        "trip_distance": [2.5], "passenger_count": [1],
    })
    row = prepare_features(df).iloc[0]
    assert row["pickup_hour"] == 8
    assert row["pickup_dow"] == 0


def test_no_post_trip_leakage_columns():
    leaky = {"fare_amount", "tip_amount", "total_amount", "tolls_amount", "tpep_dropoff_datetime"}
    assert leaky.isdisjoint(FEATURES)


def _hour(ts) -> int:
    df = pd.DataFrame({
        "tpep_pickup_datetime": [pd.Timestamp(ts)],
        "PULocationID": [161], "DOLocationID": [236],
        "trip_distance": [2.5], "passenger_count": [1],
    })
    return int(prepare_features(df)["pickup_hour"].iloc[0])


def test_timezone_aware_pickup_converted_to_nyc():
    assert _hour("2025-01-27T03:30:00") == 3          # naive = already NYC local
    assert _hour("2025-01-27T08:30:00Z") == 3         # UTC -> EST (UTC-5)
    assert _hour("2025-01-27T03:30:00-05:00") == 3    # explicit NYC offset
    assert _hour("2025-07-04T12:30:00Z") == 8         # summer: EDT (UTC-4)


def test_utc_conversion_can_change_the_day():
    df = pd.DataFrame({
        "tpep_pickup_datetime": [pd.Timestamp("2025-01-28T02:00:00Z")],  # Mon 21:00 in NYC
        "PULocationID": [1], "DOLocationID": [1], "trip_distance": [1.0], "passenger_count": [1],
    })
    row = prepare_features(df).iloc[0]
    assert (row["pickup_hour"], row["pickup_dow"]) == (21, 0)
