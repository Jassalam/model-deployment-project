"""Loading, cleaning and splitting the January 2025 Yellow Taxi data."""

import urllib.request
from pathlib import Path

import pandas as pd

from src.paths import DATA_DIR

DATA_URL = "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2025-01.parquet"
DATA_PATH = DATA_DIR / "yellow_tripdata_2025-01.parquet"

MIN_DURATION, MAX_DURATION = 1, 60  # minutes
MAX_DISTANCE = 100  # miles
SPLIT_DATE = pd.Timestamp("2025-01-25")  # train: Jan 1-24, validation: Jan 25-31

RAW_COLUMNS = [
    "tpep_pickup_datetime",
    "tpep_dropoff_datetime",
    "PULocationID",
    "DOLocationID",
    "trip_distance",
    "passenger_count",
]


def download(path: Path = DATA_PATH, url: str = DATA_URL) -> None:
    """Download to a temporary .part file and rename only when complete.

    An interrupted download then leaves no file at `path`, so the next run
    retries instead of failing on a truncated parquet file.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    try:
        urllib.request.urlretrieve(url, tmp)
        tmp.replace(path)
    finally:
        tmp.unlink(missing_ok=True)


def load_raw(path: Path = DATA_PATH) -> pd.DataFrame:
    if not path.exists():
        download(path)
    return pd.read_parquet(path, columns=RAW_COLUMNS)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Add the `duration` target (minutes) and drop implausible trips."""
    df = df.copy()
    df["duration"] = (
        df["tpep_dropoff_datetime"] - df["tpep_pickup_datetime"]
    ).dt.total_seconds() / 60

    mask = (
        df["duration"].between(MIN_DURATION, MAX_DURATION)
        & df["trip_distance"].gt(0)
        & df["trip_distance"].le(MAX_DISTANCE)
        & df["tpep_pickup_datetime"].between("2025-01-01", "2025-02-01", inclusive="left")
    )
    return df.loc[mask].reset_index(drop=True)


def split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Time-based split so validation simulates predicting future trips."""
    is_train = df["tpep_pickup_datetime"] < SPLIT_DATE
    return df.loc[is_train], df.loc[~is_train]
