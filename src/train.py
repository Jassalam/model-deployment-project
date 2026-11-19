"""Train a RandomForestRegressor for trip duration and log the run to MLflow.

Usage:
    uv run python -m src.train
    uv run python -m src.train --n-estimators 100 --max-depth 25 --train-sample 1000000
"""

import os

os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")

from pathlib import Path  # noqa: E402

import click  # noqa: E402
import mlflow  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import skops.io as sio  # noqa: E402
from sklearn.ensemble import RandomForestRegressor  # noqa: E402
from sklearn.metrics import root_mean_squared_error  # noqa: E402

from src.data import clean, load_raw, split  # noqa: E402
from src.features import FEATURES, prepare_features  # noqa: E402
from src.model import DEFAULT_MODEL_PATH  # noqa: E402

TRACKING_URI = "sqlite:///mlflow.db"
EXPERIMENT = "nyc-taxi-duration"
SEED = 42


def load_splits(train_sample: int | None = None, seed: int = SEED):
    """Return (X_train, y_train, X_val, y_val), optionally sub-sampling the training split."""
    train_df, val_df = split(clean(load_raw()))
    if train_sample and train_sample < len(train_df):
        train_df = train_df.sample(train_sample, random_state=seed)
    return (
        prepare_features(train_df), train_df["duration"].to_numpy(),
        prepare_features(val_df), val_df["duration"].to_numpy(),
    )


def fit_and_score(params: dict, X_train: pd.DataFrame, y_train: np.ndarray,
                  X_val: pd.DataFrame, y_val: np.ndarray):
    """Fit a forest with `params`; return (model, rmse_train, rmse_val)."""
    model = RandomForestRegressor(**params, n_jobs=-1, random_state=SEED).fit(X_train, y_train)
    rmse_train = root_mean_squared_error(y_train, model.predict(X_train))
    rmse_val = root_mean_squared_error(y_val, model.predict(X_val))
    return model, rmse_train, rmse_val


def log_final_model(model: RandomForestRegressor, path=DEFAULT_MODEL_PATH) -> None:
    """Save the model with skops and attach it (plus importances) to the active MLflow run."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sio.dump(model, path)
    mlflow.log_artifact(str(path))
    mlflow.log_dict(dict(zip(FEATURES, model.feature_importances_.round(4).tolist())),
                    "feature_importances.json")


def setup_mlflow() -> None:
    mlflow.set_tracking_uri(TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT)


@click.command()
@click.option("--n-estimators", default=50, show_default=True)
@click.option("--max-depth", default=20, show_default=True)
@click.option("--min-samples-leaf", default=5, show_default=True)
@click.option("--max-features", default=1.0, show_default=True,
              help="Fraction of features tried at each split.")
@click.option("--train-sample", default=500_000, show_default=True,
              help="Rows sampled from the training split (RF is slow on all 2.5M).")
@click.option("--run-name", default="rf-baseline", show_default=True)
@click.option("--output", default=str(DEFAULT_MODEL_PATH), show_default=True,
              type=click.Path(path_type=Path), help="Where to save the trained model.")
def main(n_estimators, max_depth, min_samples_leaf, max_features, train_sample, run_name, output):
    X_train, y_train, X_val, y_val = load_splits(train_sample)
    params = {"n_estimators": n_estimators, "max_depth": max_depth,
              "min_samples_leaf": min_samples_leaf, "max_features": max_features}

    setup_mlflow()
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params({**params, "random_state": SEED, "train_rows": len(X_train),
                           "val_rows": len(X_val), "features": ",".join(FEATURES)})
        model, rmse_train, rmse_val = fit_and_score(params, X_train, y_train, X_val, y_val)
        # Reference point: always predicting the training mean.
        rmse_mean = root_mean_squared_error(y_val, np.full_like(y_val, y_train.mean()))
        mlflow.log_metrics({"rmse_train": rmse_train, "rmse_val": rmse_val,
                            "rmse_val_mean_baseline": rmse_mean})
        log_final_model(model, output)
        mlflow.log_metric("model_size_mb", output.stat().st_size / 1e6)

    click.echo(f"run_id={run.info.run_id}")
    click.echo(f"RMSE train={rmse_train:.3f}  val={rmse_val:.3f}  (mean baseline {rmse_mean:.3f})")
    click.echo(f"Model saved to {output} ({output.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
