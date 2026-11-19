"""Review fixes 2.2 (paths), 2.3 (training defaults) and 2.7 (MLflow experiment label)."""

import json

import mlflow

from src.data import DATA_PATH
from src.model import DEFAULT_MODEL_PATH, model_path
from src.paths import PROJECT_ROOT
from src.train import EXPERIMENT, EXPERIMENT_KIND, TRACKING_URI, main, setup_mlflow


# --- 2.2: paths don't depend on the working directory ---------------------------

def test_paths_are_anchored_to_project_root():
    assert (PROJECT_ROOT / "pyproject.toml").exists()
    for p in (DATA_PATH, DEFAULT_MODEL_PATH):
        assert p.is_absolute() and PROJECT_ROOT in p.parents
    assert str(PROJECT_ROOT / "mlflow.db") in TRACKING_URI


def test_paths_unchanged_after_changing_directory(monkeypatch, tmp_path):
    monkeypatch.delenv("MODEL_PATH", raising=False)
    monkeypatch.chdir(tmp_path)
    assert model_path() == DEFAULT_MODEL_PATH
    assert json.loads((PROJECT_ROOT / "sample-request.json").read_text())["PULocationID"]


# --- 2.3: the plain training command produces the final (full-data) model -----

def test_default_training_is_full_data_to_served_path():
    defaults = {p.name: p.default for p in main.params}
    assert defaults["train_sample"] == 0          # 0 = all training rows
    assert defaults["run_name"] == "rf-fulldata"
    assert str(defaults["output"]) == str(DEFAULT_MODEL_PATH)


# --- 2.7: experiment is labelled as model training in code ---------------------

def test_setup_mlflow_labels_experiment(tmp_path):
    uri = f"sqlite:///{tmp_path / 'mlflow.db'}"
    try:
        setup_mlflow(uri)
        tags = mlflow.get_experiment_by_name(EXPERIMENT).tags
    finally:
        mlflow.set_tracking_uri(None)
    for key, value in EXPERIMENT_KIND.items():
        assert tags[key] == value
