"""Feature preparation shared by training and the API.

Only fields that are known when a trip *starts* are used, so the model can
be called before the ride happens (no fare/tip/total leakage).
"""

import pandas as pd

FEATURES = [
    "PULocationID",
    "DOLocationID",
    "trip_distance",
    "passenger_count",
    "pickup_hour",
    "pickup_dow",
]


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    """Turn raw trip columns into the model's feature matrix.

    Expects columns: PULocationID, DOLocationID, trip_distance,
    passenger_count (may be missing), tpep_pickup_datetime.
    """
    pickup = pd.to_datetime(df["tpep_pickup_datetime"])
    out = pd.DataFrame(
        {
            "PULocationID": df["PULocationID"].astype("int32"),
            "DOLocationID": df["DOLocationID"].astype("int32"),
            "trip_distance": df["trip_distance"].astype("float64"),
            "passenger_count": df["passenger_count"].fillna(1).astype("float64"),
            "pickup_hour": pickup.dt.hour.astype("int32"),
            "pickup_dow": pickup.dt.dayofweek.astype("int32"),
        },
        index=df.index,
    )
    return out[FEATURES]
