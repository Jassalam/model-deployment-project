import pandas as pd

from src.data import MAX_DURATION, MAX_SPEED, MIN_DURATION, MIN_SPEED, SPLIT_DATE, clean, split


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
        _raw("2025-01-10 08:00", 10, 2.0),     # keep (12 mph)
        _raw("2025-01-10 08:01", 0.5, 0.1),    # too short
        _raw("2025-01-10 08:02", 181, 40.0),   # too long
        _raw("2025-01-10 08:03", -5, 2.0),     # negative duration
        _raw("2025-01-10 08:04", 10, 0.0),     # zero distance
        _raw("2025-01-10 08:05", 10, 500.0),   # absurd distance
        _raw("2024-12-31 23:00", 10, 2.0),     # outside January
        _raw("2025-02-01 00:10", 10, 2.0),     # outside January
    ]
    out = clean(pd.DataFrame(rows))
    assert len(out) == 1
    assert out["duration"].between(MIN_DURATION, MAX_DURATION).all()


def test_clean_keeps_long_real_trips():
    """Review fix 2.4: a 90-min, 20-mile airport run (13 mph) is real and must be kept."""
    out = clean(pd.DataFrame([_raw("2025-01-10 16:00", 90, 20.0)]))
    assert out["duration"].tolist() == [90]


def test_clean_drops_impossible_speeds():
    rows = [
        _raw("2025-01-10 08:00", 30, 0.2),   # 0.4 mph: meter left running
        _raw("2025-01-10 08:01", 10, 15.0),  # 90 mph: impossible in NYC
        _raw("2025-01-10 08:02", 30, 5.0),   # 10 mph: keep
    ]
    out = clean(pd.DataFrame(rows))
    assert len(out) == 1 and out["trip_distance"].iloc[0] == 5.0
    speed = out["trip_distance"] / (out["duration"] / 60)
    assert speed.between(MIN_SPEED, MAX_SPEED).all()


def test_clean_keeps_refund_pairs_once():
    """Review fix 2.5: a refund adds a second record of the same trip; count it once."""
    trip = _raw("2025-01-10 08:00", 12, 2.0)
    other = _raw("2025-01-10 08:00", 12, 2.1)  # same time, different trip: keep
    out = clean(pd.DataFrame([trip, trip, other]))
    assert len(out) == 2


def test_split_is_by_time_with_no_overlap(trips):
    early = trips.assign(tpep_pickup_datetime=pd.Timestamp("2025-01-10"))
    late = trips.assign(tpep_pickup_datetime=pd.Timestamp("2025-01-28"))
    train, val = split(pd.concat([early, late], ignore_index=True))
    assert len(train) == len(early) and len(val) == len(late)
    assert train["tpep_pickup_datetime"].max() < SPLIT_DATE <= val["tpep_pickup_datetime"].min()


# --- Review fix 2.8: safe download --------------------------------------------

import urllib.request  # noqa: E402

import pytest  # noqa: E402

from src.data import download  # noqa: E402


def test_interrupted_download_leaves_no_file(monkeypatch, tmp_path):
    def broken(url, filename):
        with open(filename, "wb") as f:
            f.write(b"PAR1 truncated...")
        raise ConnectionResetError("connection dropped")

    monkeypatch.setattr(urllib.request, "urlretrieve", broken)
    target = tmp_path / "data" / "trips.parquet"
    with pytest.raises(ConnectionResetError):
        download(target, url="http://example.invalid/trips.parquet")
    assert not target.exists()
    assert list(target.parent.iterdir()) == []  # no leftover .part file


def test_successful_download_lands_at_target(monkeypatch, tmp_path):
    def ok(url, filename):
        with open(filename, "wb") as f:
            f.write(b"complete file")

    monkeypatch.setattr(urllib.request, "urlretrieve", ok)
    target = tmp_path / "trips.parquet"
    download(target, url="http://example.invalid/trips.parquet")
    assert target.read_bytes() == b"complete file"
    assert [p.name for p in tmp_path.iterdir()] == ["trips.parquet"]
