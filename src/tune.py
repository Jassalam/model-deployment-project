"""Optuna hyperparameter search for the trip-duration random forest.

To keep the final validation week (Jan 25-31) untouched, trials are scored on
an inner split of the *training* period: fit on Jan 1-17, score on Jan 18-24.
The best params are then refit on the same 500k training sample the baseline
used and evaluated once on Jan 25-31, so the comparison is like-for-like.

Usage:
    uv run python -m src.tune --n-trials 25
"""

import os

os.environ.setdefault("MLFLOW_DISABLE_AGENT_HINT", "1")

import time  # noqa: E402

import click  # noqa: E402
import mlflow  # noqa: E402
import optuna  # noqa: E402
import pandas as pd  # noqa: E402

from src.data import clean, load_raw, split  # noqa: E402
from src.features import FEATURES, prepare_features  # noqa: E402
from src.paths import ARTIFACTS_DIR  # noqa: E402
from src.train import SEED, fit_and_score, log_final_model, setup_mlflow  # noqa: E402

INNER_SPLIT_DATE = pd.Timestamp("2025-01-18")
TUNED_MODEL_PATH = ARTIFACTS_DIR / "model_tuned.skops"


def search_space(trial: optuna.Trial) -> dict:
    return {
        "n_estimators": trial.suggest_int("n_estimators", 50, 200, step=25),
        "max_depth": trial.suggest_int("max_depth", 10, 40),
        "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 50, log=True),
        "max_features": trial.suggest_categorical("max_features", [0.33, 0.5, 0.75, 1.0]),
    }


@click.command()
@click.option("--n-trials", default=25, show_default=True)
@click.option("--tune-sample", default=200_000, show_default=True,
              help="Rows used to fit each trial (smaller = faster search).")
@click.option("--train-sample", default=500_000, show_default=True,
              help="Rows used for the final refit (same as the baseline).")
def main(n_trials, tune_sample, train_sample):
    train_df, val_df = split(clean(load_raw()))

    inner_fit = train_df[train_df["tpep_pickup_datetime"] < INNER_SPLIT_DATE]
    inner_val = train_df[train_df["tpep_pickup_datetime"] >= INNER_SPLIT_DATE]
    inner_fit = inner_fit.sample(min(tune_sample, len(inner_fit)), random_state=SEED)
    inner_val = inner_val.sample(min(200_000, len(inner_val)), random_state=SEED)
    Xf, yf = prepare_features(inner_fit), inner_fit["duration"].to_numpy()
    Xv, yv = prepare_features(inner_val), inner_val["duration"].to_numpy()

    setup_mlflow()
    with mlflow.start_run(run_name="rf-optuna") as parent:
        mlflow.log_params({"n_trials": n_trials, "tune_rows": len(Xf), "tune_val_rows": len(Xv),
                           "inner_split_date": str(INNER_SPLIT_DATE.date())})

        def objective(trial: optuna.Trial) -> float:
            params = search_space(trial)
            start = time.perf_counter()
            _, rmse_fit, rmse_inner = fit_and_score(params, Xf, yf, Xv, yv)
            with mlflow.start_run(run_name=f"trial-{trial.number}", nested=True):
                mlflow.log_params(params)
                mlflow.log_metrics({"rmse_tune_fit": rmse_fit, "rmse_tune_val": rmse_inner,
                                    "fit_seconds": time.perf_counter() - start})
            click.echo(f"trial {trial.number:>2}: rmse={rmse_inner:.4f} {params}")
            return rmse_inner

        optuna.logging.set_verbosity(optuna.logging.WARNING)
        study = optuna.create_study(direction="minimize",
                                    sampler=optuna.samplers.TPESampler(seed=SEED))
        study.optimize(objective, n_trials=n_trials)
        best = study.best_params
        mlflow.log_params({f"best_{k}": v for k, v in best.items()})
        mlflow.log_metric("best_rmse_tune_val", study.best_value)

        # Final refit on the same training sample as the baseline, scored on Jan 25-31.
        final_train = train_df.sample(min(train_sample, len(train_df)), random_state=SEED)
        X_train, y_train = prepare_features(final_train), final_train["duration"].to_numpy()
        X_val, y_val = prepare_features(val_df), val_df["duration"].to_numpy()
        start = time.perf_counter()
        model, rmse_train, rmse_val = fit_and_score(best, X_train, y_train, X_val, y_val)
        fit_seconds = time.perf_counter() - start

        mlflow.log_params({"train_rows": len(X_train), "val_rows": len(X_val),
                           "features": ",".join(FEATURES)})
        mlflow.log_metrics({"rmse_train": rmse_train, "rmse_val": rmse_val,
                            "final_fit_seconds": fit_seconds})
        log_final_model(model, TUNED_MODEL_PATH)
        size_mb = TUNED_MODEL_PATH.stat().st_size / 1e6
        mlflow.log_metric("model_size_mb", size_mb)

    click.echo(f"\nrun_id={parent.info.run_id}")
    click.echo(f"best params: {best}  (inner rmse {study.best_value:.4f})")
    click.echo(f"final RMSE train={rmse_train:.3f}  val={rmse_val:.3f}")
    click.echo(f"fit {fit_seconds:.1f}s, model {size_mb:.0f} MB -> {TUNED_MODEL_PATH}")


if __name__ == "__main__":
    main()
