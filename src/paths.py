"""Project-root-anchored paths, so code works no matter which folder it is run from."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
MLFLOW_DB = PROJECT_ROOT / "mlflow.db"
