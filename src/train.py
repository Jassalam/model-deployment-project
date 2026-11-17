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
import skops.io as sio  # noqa: E402
from sklearn.ensemble import RandomForestRegressor  # noqa: E402
from sklearn.metrics import root_mean_squared_error  # noqa: E402

from src.data import clean, load_raw, split  # noqa: E402
from src.features import FEATURES, prepare_features  # noqa: E402

MODEL_PATH = Path("artifacts/model.skops")
TRACKING_URI = "sqlite:///mlflow.db"
EXPERIMENT = "nyc-taxi-duration"
SEED = 42


@click.command()
@click.option("--n-estimators", default=50, show_default=True)
@click.option("--max-depth", default=20, show_default=True)
@click.option("--min-samples-leaf", default=5, show_default=True)
@click.option("--train-sample", default=500_000, show_default=True,
              help="Rows sampled from the training split (RF is slow on all 2.5M).")
@click.option("--run-name", default="rf-baseline", show_default=True)
def main(n_estimators, max_depth, min_samples_leaf, train_sample, run_name):
    df = clean(load_raw())
    train_df, val_df = split(df)
    if train_sample and train_sample < len(train_df):
        train_df = train_df.sample(train_sample, random_state=SEED)

    X_train, y_train = prepare_features(train_df), train_df["duration"].to_numpy()
    X_val, y_val = prepare_features(val_df), val_df["duration"].to_numpy()

    params = {
        "n_estimators": n_estimators,
        "max_depth": max_depth,
        "min_samples_leaf": min_samples_leaf,
        "n_jobs": -1,
        "random_state": SEED,
    }

    mlflow.set_tracking_uri(TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT)
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params(params)
        mlflow.log_params({"train_rows": len(X_train), "val_rows": len(X_val),
                           "features": ",".join(FEATURES)})

        model = RandomForestRegressor(**params).fit(X_train, y_train)

        rmse_train = root_mean_squared_error(y_train, model.predict(X_train))
        rmse_val = root_mean_squared_error(y_val, model.predict(X_val))
        # Reference point: always predicting the training mean.
        rmse_mean = root_mean_squared_error(y_val, np.full_like(y_val, y_train.mean()))
        mlflow.log_metrics({"rmse_train": rmse_train, "rmse_val": rmse_val,
                            "rmse_val_mean_baseline": rmse_mean})

        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        sio.dump(model, MODEL_PATH)
        mlflow.log_artifact(str(MODEL_PATH))
        mlflow.log_dict(dict(zip(FEATURES, model.feature_importances_.round(4).tolist())),
                        "feature_importances.json")

    click.echo(f"run_id={run.info.run_id}")
    click.echo(f"RMSE train={rmse_train:.3f}  val={rmse_val:.3f}  (mean baseline {rmse_mean:.3f})")
    click.echo(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
