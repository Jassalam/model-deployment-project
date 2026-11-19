"""Loading the trained model and making predictions from raw trip fields.

Used by the API so serving goes through exactly the same feature code as training.
"""

import os
from pathlib import Path

import pandas as pd
import skops.io as sio
from sklearn.ensemble import RandomForestRegressor

from src.features import prepare_features

DEFAULT_MODEL_PATH = Path("artifacts/model.skops")

# skops refuses to load types it doesn't know are safe. A random forest only
# needs sklearn's Tree type; anything else in the file is rejected.
TRUSTED_TYPES = ["sklearn.tree._tree.Tree"]


def model_path() -> Path:
    """Model location; override with the MODEL_PATH environment variable."""
    return Path(os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH))


def load_model(path: Path | None = None) -> RandomForestRegressor:
    path = path or model_path()
    if not path.exists():
        raise FileNotFoundError(
            f"No model at {path}. Train one first: uv run python -m src.train"
        )
    return sio.load(path, trusted=TRUSTED_TYPES)


def predict(model: RandomForestRegressor, trips: pd.DataFrame) -> list[float]:
    """Predict duration in minutes for raw trip rows."""
    return model.predict(prepare_features(trips)).tolist()
