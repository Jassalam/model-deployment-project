# Project Process Log

A record of every step taken so far to build, track and serve the NYC Yellow Taxi
trip-duration model (January 2025 data). The steps follow the "Suggested Workflow" in
[project-description.md](project-description.md).

**Status:** all 9 steps and all three stretch tasks are done.

**Current final model (v2):** the baseline settings trained on all 2.52M training trips,
using the v2 cleaning rules (1–180 min, 1–65 mph, refund pairs counted once).
**Validation RMSE: 4.786 minutes.**

The earlier figure of 3.958 only covered trips under an hour, because longer trips had been
removed from the data. On the same validation trips as v2, the v1 model scores 5.131. See
"Review Fixes, Step 2" below.

**Branches:**

- `feature/trip-duration-model`: the original work, merged into `main` as PR #1.
- `fix/review-findings`: the review fixes, in PR #2.

---

## Step 0: Environment Setup

**Goal:** confirm that the tools and libraries work before writing any code.

```bash
uv --version     # uv 0.13.7
uv sync          # installs everything from uv.lock into .venv/
git checkout -b feature/trip-duration-model
```

Library versions in use: scikit-learn 1.9.1, MLflow 3.17.2, FastAPI 0.162.0, pandas 3.0.1.
Python is 3.13.

Work happens on a feature branch, because the README asks for progress to be tracked
through pull requests.

---

## Step 1: Load and Inspect the Data

**Goal:** get the January 2025 data and see which columns could affect trip duration.

The file came from the NYC TLC public download:

```bash
mkdir -p data
curl -sSfL -o data/yellow_tripdata_2025-01.parquet \
  https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2025-01.parquet
```

It is a 56 MB parquet file with **3,475,226 trips and 20 columns**.

**What the inspection found:**

| Finding | Detail |
|---|---|
| Duration has bad values | Computed duration ranges from **−51,472 min** to **5,626 min**. |
| Most trips are reasonable | The median trip is 11.7 min, and **97.9%** of trips take 1–60 min. |
| Missing values | 540,149 rows (about 15.5%) have no `passenger_count`, `RatecodeID`, `congestion_surcharge` or `Airport_fee`. |
| Distance outliers | `trip_distance` reaches 276,424 miles, and some trips have distance 0. |
| Dates outside January | Some pickups fall on 31 Dec 2024 or 1 Feb 2025. |

**Choosing the features:** a prediction API is called when a trip *starts*, so the
model can only use fields known at that moment:

- **Used:** pickup zone (`PULocationID`), dropoff zone (`DOLocationID`),
  `trip_distance`, `passenger_count`, and pickup time (`tpep_pickup_datetime`).
- **Excluded:** `fare_amount`, `tip_amount`, `total_amount`, `tolls_amount` and the
  other charges. They are only known after the trip ends and are largely computed from
  its duration, so using them would leak the answer into the model.

---

## Step 2: Clean the Data and Define the Target

**Goal:** a clean training table with a `duration` column.

The code is in [src/data.py](src/data.py).

- **Target:** `duration = (tpep_dropoff_datetime − tpep_pickup_datetime)` in minutes.
- **Filters applied:**
  - duration between 1 and 60 minutes;
  - `trip_distance` greater than 0 and at most 100 miles;
  - pickup time between 1 and 31 January 2025.
- `load_raw()` reads only the 6 columns that are needed, and downloads the file if it is
  missing.

**Result:** **3,339,084 clean trips**, about 96% of the raw rows. After cleaning,
durations have a mean of 14.2 min and a median of 11.7 min.

**Feature engineering** is in [src/features.py](src/features.py). Training and the API
both call the same function, `prepare_features(df)`:

| Feature | How it is built |
|---|---|
| `PULocationID`, `DOLocationID` | Zone IDs, kept as integers |
| `trip_distance` | Miles, as given |
| `passenger_count` | Missing values filled with 1, the most common value |
| `pickup_hour` | Hour of the pickup time (0–23) |
| `pickup_dow` | Day of week of the pickup (0 = Monday) |

---

## Step 3: Split into Train and Validation Sets

**Goal:** an honest estimate of how the model does on new trips.

The split is **by time, not at random**:

- **Train:** pickups from Jan 1 to Jan 24, which is **2,540,706 trips**.
- **Validation:** pickups from Jan 25 to Jan 31, which is **798,378 trips**.

**Why:** in real use the model predicts future trips. A random split mixes trips from the
same days into both sets, which tends to make the score look better than it really is.

---

## Step 4: Train the Baseline Random Forest

**Goal:** a first working model.

The code is in [src/train.py](src/train.py).

```bash
uv run python -m src.train
```

> **Note (changed later):** at this stage the command's default was a 500,000-row sample.
> Since the review fixes, the plain command trains the **final full-data model** instead
> (see "Review Fixes" below). To reproduce this baseline now, run:
> `uv run python -m src.train --train-sample 500000 --run-name rf-baseline --output artifacts/model_baseline.skops`

| Parameter | Value | Reason |
|---|---|---|
| `n_estimators` | 50 | Enough trees for a stable baseline |
| `max_depth` | 20 | Limits model size and overfitting |
| `min_samples_leaf` | 5 | Smooths predictions |
| `train_sample` | 500,000 rows | A random forest on all 2.5M rows is slow, so the baseline trains on a random sample |
| `random_state` | 42 | Makes results reproducible |
| `n_jobs` | -1 | Uses all CPU cores |

Every parameter can be changed from the command line, for example
`--n-estimators 100 --max-depth 25 --train-sample 1000000`.

Training took **about 12 seconds**. The model is saved to `artifacts/model.skops`
(237 MB, not committed to git). It is saved with **skops** rather than pickle, because
skops can be loaded safely: it refuses to load anything it doesn't recognise.

---

## Step 5: Evaluate with RMSE and Log to MLflow

**Goal:** measure the error and record the run so later runs can be compared.

### Results (baseline run `0f2c54dcc26a4102a5b7ce47eb25f3e8`)

| Metric | RMSE (minutes) |
|---|---|
| Training rows (`rmse_train`) | 3.362 |
| **Validation week (`rmse_val`)** | **4.105** |
| Always predicting the training mean (`rmse_val_mean_baseline`) | 9.589 |

- The model's error is **57% lower** than always guessing the average trip length.
- The gap between the training and validation RMSE (3.36 vs 4.11) shows **mild
  overfitting**.

### Feature importances

| Feature | Importance |
|---|---|
| `trip_distance` | 0.852 |
| `pickup_hour` | 0.052 |
| `DOLocationID` | 0.039 |
| `PULocationID` | 0.034 |
| `pickup_dow` | 0.021 |
| `passenger_count` | 0.002 |

Distance explains most of the prediction. Time of day and the two zones add the effect
of traffic. Passenger count adds almost nothing.

### What is logged to MLflow for each run

- **Parameters:** all model settings, the row counts and the feature list.
- **Metrics:** `rmse_train`, `rmse_val` and `rmse_val_mean_baseline`.
- **Artifacts:** the model file (`model.skops`) and `feature_importances.json`.
- **Experiment name:** `nyc-taxi-duration`.

### Problem hit: MLflow file store rejected

The first training run failed. MLflow 3.17 no longer accepts the plain `./mlruns` folder
as a tracking store:

```
MlflowException: The filesystem tracking backend (e.g., './mlruns') is in maintenance mode...
Please migrate to a database backend (e.g., 'sqlite:///mlflow.db')
```

**Fix:** tracking now uses a local SQLite database, `sqlite:///mlflow.db`. Run artifacts
are still stored under `mlruns/`. The README command for opening the MLflow UI was
updated to match:

```bash
uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
# then open http://127.0.0.1:5000
```

---

## Step 6: Reusable Modules for Training and Serving

**Goal:** the API must prepare its input exactly the way training did.

| Module | Used by | Purpose |
|---|---|---|
| [src/data.py](src/data.py) | training | Load, clean and split the data |
| [src/features.py](src/features.py) | training and API | `prepare_features()`, one definition of the features |
| [src/model.py](src/model.py) | API | `load_model()` and `predict()` |
| [src/train.py](src/train.py) | command line | Train the model, log to MLflow, save the model file |

`load_model()` passes skops an explicit list of trusted types. A random forest only
needs `sklearn.tree._tree.Tree`, so the loader refuses any other type found in the file.
If no model file exists yet, it raises a clear error telling you to run training first.

---

## Step 7: Build the FastAPI App

**Goal:** serve predictions over HTTP.

The code is in [app/main.py](app/main.py) and [app/schemas.py](app/schemas.py).

**Endpoints:**

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{"status": "ok", "model_loaded": true}` |
| POST | `/predict` | `{"duration_minutes": <float>, "model_version": "rf-<timestamp>"}` |
| GET | `/docs` | Interactive API docs that FastAPI generates automatically |

**Request schema (`Trip`).** Bad input is rejected with HTTP 422 before it reaches the
model.

| Field | Type | Rule |
|---|---|---|
| `PULocationID` | int | 1–265 |
| `DOLocationID` | int | 1–265 |
| `trip_distance` | float | greater than 0, at most 100 |
| `passenger_count` | int, optional | 0–9 |
| `tpep_pickup_datetime` | datetime | ISO format, e.g. `2025-01-27T08:30:00` |

**Design choices:**

- The model is loaded **once at startup**, using FastAPI's lifespan hook, rather than on
  every request. The file is 237 MB.
- `model_version` comes from the model file's save time, so every response shows which
  model produced it.

---

## Step 8: Run the API Locally and Send Requests

**Goal:** prove the endpoint works end to end.

Deployment uses **uvicorn directly**, one of the two options in the project description
(the other is Docker).

```bash
uv run uvicorn app.main:app --reload --port 8000
```

The sample request is in [sample-request.json](sample-request.json):

```json
{
  "PULocationID": 161,
  "DOLocationID": 236,
  "trip_distance": 2.5,
  "passenger_count": 1,
  "tpep_pickup_datetime": "2025-01-27T08:30:00"
}
```

```bash
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" -d @sample-request.json
```

**Test results:**

| Request | Response |
|---|---|
| `GET /health` | `{"status":"ok","model_loaded":true}` |
| Sample request: zone 161 → 236, 2.5 mi, Monday 8:30am | `{"duration_minutes":17.54,"model_version":"rf-20261117163021"}` |
| JFK (zone 132) → Times Square (zone 230), 17.5 mi, Tuesday 5:30pm | `{"duration_minutes":48.8, ...}` |
| `PULocationID: 999` (invalid zone) | **HTTP 422**, "Input should be less than or equal to 265" |

The predictions are plausible: a short Midtown trip in morning rush hour takes about
18 minutes, and an airport run in evening rush hour takes about 49 minutes.

---

## Stretch Task 1: Tests

**Goal:** automated checks for the data pipeline, the model and the API.

```bash
uv run pytest -q     # 22 passed in ~0.5 s
```

**Setup:**

- Added `[tool.pytest.ini_options]` to [pyproject.toml](pyproject.toml), with
  `pythonpath = ["."]` so tests can import `src` and `app`.
- [tests/conftest.py](tests/conftest.py) builds **200 synthetic trips** in which duration
  grows with distance. It trains a **tiny 5-tree forest** on them and saves it with skops,
  the same way training saves the real model. As a result the tests need neither the
  56 MB dataset nor the large real model files, and run in under a second.
- To let the API tests load that tiny model, the model location is now configurable:
  `src/model.py` reads the `MODEL_PATH` environment variable and falls back to
  `artifacts/model.skops`.

**What is tested:**

| File | Tests | What they check |
|---|---|---|
| [tests/test_data.py](tests/test_data.py) | 3 | Duration is computed in minutes. Each cleaning rule drops its bad row (too short, too long, negative, zero distance, absurd distance, outside January). The split is by time and the two sets don't overlap. |
| [tests/test_features.py](tests/test_features.py) | 4 | Feature columns and their order. Missing passenger count becomes 1. Hour and day of week are correct (Mon 08:30 gives hour 8, day 0). No column that leaks post-trip information is a feature. |
| [tests/test_model.py](tests/test_model.py) | 5 | The model loads and predicts floats. It learns the signal (RMSE under 5 on the synthetic trips). A missing model file gives a clear error. The `MODEL_PATH` override works. With the **real** model, a longer trip is predicted to take longer, and both predictions fall within 1–60 min. This last test is skipped if no trained model exists. |
| [tests/test_api.py](tests/test_api.py) | 10 | `/health` works. `/predict` returns 200 for the sample request. `passenger_count` is optional. Six kinds of invalid input each return 422 naming the right field. A missing required field returns 422. |

**Dependency note:** FastAPI's `TestClient` now uses the `httpx2` package instead of
`httpx`. `httpx2` is already in the project's dev dependencies, so nothing extra had to be
installed.

---

## Stretch Task 2: Hyperparameter Tuning with Optuna

**Goal:** find better random forest settings and log the search to MLflow.

The code is in [src/tune.py](src/tune.py).

```bash
uv run python -m src.tune --n-trials 25
```

### Preventing leakage into the final score

If the best trial were chosen by its score on the Jan 25–31 validation week, that week
would no longer be a fair test, and the tuned model would look better than it really is.
So the search uses an **inner split of the training period only**:

| Purpose | Data |
|---|---|
| Fit each trial | Jan 1–17, random sample of 200,000 rows |
| Score each trial | Jan 18–24, random sample of 200,000 rows |
| Final refit with the best settings | The **same 500,000-row sample** the baseline used (same seed) |
| Final score, used once | Jan 25–31, all 798,378 rows |

Because the final refit uses the baseline's exact training sample, the comparison with
the baseline is like-for-like.

### Search space (TPE sampler, seed 42)

| Parameter | Range |
|---|---|
| `n_estimators` | 50–200, in steps of 25 |
| `max_depth` | 10–40 |
| `min_samples_leaf` | 1–50, log scale |
| `max_features` | 0.33, 0.5, 0.75 or 1.0 |

### Results

- **25 trials in 95 seconds** of wall-clock time.
- Each trial is a nested MLflow run under the parent run `rf-optuna`
  (`5711be66c89246f3adfbbc4d7968f338`).
- Inner RMSE ranged from **4.117 to 4.500**.
- **Best settings:** `n_estimators=150`, `max_depth=26`, `min_samples_leaf=3`,
  `max_features=0.5`, with an inner RMSE of 4.117.

What the trials showed:

- **`max_features=0.5`** appears in most of the good trials. Trying only half the features
  at each split makes the trees more different from each other, which helps the average.
- **Very shallow trees** (depth 10–13) underfit, with RMSE around 4.22–4.35.
- **Large leaves** (`min_samples_leaf` ≥ 15) with `max_features=0.33` were the worst, at
  about 4.47–4.50.

---

## Stretch Task 3: Baseline vs. Tuned, and Was It Worth It?

Tuning was not the only option, so I also tested a cheaper one: keep the **baseline
settings** and train on **all 2,540,706 training rows** instead of 500,000.

```bash
uv run python -m src.train --train-sample 0 --run-name rf-baseline-fulldata \
  --output artifacts/model_fulldata.skops
```

(I added the `--output` option to [src/train.py](src/train.py) so this run would not
overwrite the baseline model file. `--train-sample 0` means use all rows.)

### Comparison (validation week Jan 25–31, 798,378 trips)

| Model | Training rows | Val RMSE | Train RMSE | Fit time | Model size | Load time | Latency per request |
|---|---|---|---|---|---|---|---|
| Baseline (50 trees, depth 20, leaf 5) | 500k | 4.105 | 3.362 | ~12 s | 249 MB | 0.2 s | 14.6 ms |
| Tuned (150 trees, depth 26, leaf 3, max_features 0.5) | 500k | 4.025 | 2.866 | 14.5 s | **1,681 MB** | 1.0 s | 13.3 ms |
| **Baseline settings, all data** | **2.54M** | **3.958** | 3.495 | ~38 s | 729 MB | 0.5 s | 14.7 ms |

Latency is the median of 30 single-trip predictions with the model already in memory.

### Was the extra complexity worth it?

**Tuning: not really.**

- It improved validation RMSE by only **0.08 min (2%)**, about 5 seconds per trip.
- It made the model file **7 times larger** (1.68 GB) and slower to load.
- The gap between training and validation RMSE grew from 0.74 to 1.16, so the deeper
  trees mostly memorise the training trips more closely.

**More data: yes.**

- Training the plain baseline on all 2.5M rows beat the tuned model, at **3.958**
  (3.6% better than the baseline).
- Its file is less than half the size of the tuned model's.
- It has the smallest train/validation gap of the three (0.46), so it generalises best.
- The only cost is training time, about 38 s instead of 12 s, and that is paid once.

**Takeaway:** in this problem, the amount of data mattered more than hyperparameters.
Trip distance explains about 85% of the prediction, and a random forest's defaults are
already reasonable. A better next step than more tuning is better features (see "What
I'd Do Differently" below).

### Which model is deployed

The full-data model was made the served model:

```bash
mv artifacts/model.skops artifacts/model_baseline.skops   # keep the old baseline
cp artifacts/model_fulldata.skops artifacts/model.skops   # the API loads this path
```

After restarting the API, the sample request returns
`{"duration_minutes":16.63,"model_version":"rf-20261118135929"}`, and all 22 tests still
pass.

---

## Notebook: EDA and Model Comparison

**Goal:** make the exploration reviewable. Steps 1–3 were first done as one-off terminal
commands, so nothing in the repo showed the exploration as a notebook.

[notebooks/01_eda.ipynb](notebooks/01_eda.ipynb) is committed **with its outputs and
7 charts saved**, so it can be read on GitHub without running it. It imports
`src/data.py` and `src/features.py`, so it applies exactly the same cleaning and features
as training.

**Sections:**

1. Raw data and missing values.
2. Duration outliers and the 1–60 min rule.
3. What drives duration: distance, hour, day of week, zones, passengers.
4. Leakage check.
5. Time split.
6. Model comparison and Optuna trials, read live from `mlflow.db`.

**How it was built and run:** a script wrote the notebook with `nbformat`, and it was
executed with `uv run --with nbclient`. `nbclient` was used temporarily, so the project's
dependencies didn't change. Run time is about 10 s.

**New findings from the notebook:**

- **Pearson correlation was misleading.** It reports fare vs duration as only 0.02,
  because of 126,217 negative fares and one fare of $863,372. Spearman (rank) correlation
  shows fare tracks duration *more* closely than distance does (0.87 vs 0.85). That is a
  strong reason it would leak, and the notebook shows both measures.
- **The Monday speed bump is MLK Day.** Monday Jan 20 had a median speed of 11.6 mph,
  against 9.6–9.8 on the other Mondays and 9.2 for Tuesday–Friday. This is concrete
  evidence for adding a holiday feature.

**Small fix to `src/features.py`:** `dt.dayofweek` was replaced with `dt.day_of_week`,
because pandas 3 has deprecated the old name. The values are identical, so the trained
models are unaffected, and all 22 tests still pass.

---

## Review Fixes, Step 1: Code Bugs

**Goal:** fix the six code problems found in review, without retraining the model. Each
problem is described in full in [errors-and-solutions.md](errors-and-solutions.md).

**Branch:** `fix/review-findings`, created from `main` after PR #1 was merged.

| Item | Problem | Fix | Files |
|---|---|---|---|
| 2.1 | UTC or other time-zone-aware pickup times were read as New York time | Convert time-zone-aware times to `America/New_York` before taking the hour and day | `src/features.py` |
| 2.2 | Paths depended on the folder you ran from | New `src/paths.py` with `PROJECT_ROOT`; data, model, MLflow and test paths built from it | `src/paths.py`, `src/data.py`, `src/model.py`, `src/train.py`, `src/tune.py`, `tests/test_api.py` |
| 2.3 | The plain training command overwrote the served model with the baseline | Defaults are now `--train-sample 0` and `--run-name rf-fulldata`; the baseline needs explicit options | `src/train.py` |
| 2.6 | A date with no time was accepted as midnight | Validator returns 422: "must include a time" | `app/schemas.py` |
| 2.7 | MLflow "model training" label only set by hand | `setup_mlflow()` sets `mlflow.experimentKind = custom_model_development` | `src/train.py` |
| 2.8 | An interrupted download left a corrupt data file | Download to a `.part` file and rename only when complete | `src/data.py` |

**Tests:** 11 new tests, for **33 in total, all passing**.

- To make sure the new tests really detect the bugs, the time-zone and date-only fixes were
  undone temporarily. Four tests failed, and all 33 passed again once the fixes were
  restored.
- The end-to-end API time-zone test still passed without the fix, because the tiny test
  model barely uses the hour. The feature-level tests are what actually catch that bug.

**Checked end to end with the real model, running from `notebooks/`:**

| Request `tpep_pickup_datetime` | Before | After |
|---|---|---|
| `2025-01-27T08:30:00Z` (= 03:30 New York time) | 16.63 ❌ | **13.41** ✅ |
| `1737966600` (Unix timestamp, same moment) | 16.63 ❌ | **13.41** ✅ |
| `2025-01-27T03:30:00` (New York local time) | 13.41 | 13.41 |
| `2025-01-27` (no time) | 200, 10.82 ❌ | **422** ✅ |
| `pytest` run from `notebooks/` | crashed ❌ | **33 passed** ✅ |

**Not changed yet:** the model itself. Items 2.4 and 2.5 change the training data, and are
handled in step 2 with retraining.

---

## Review Fixes, Step 2: Data Fixes and Retraining

**Goal:** fix the two data problems found in review (2.4 and 2.5), retrain, and report
honest numbers. Item 2.9 (the notebook source) was handled at the same time.

### What was changed

**1. Choosing the new cleaning rules from the data.** For trips of 1–180 min:

- 12,657 trips were slower than 1 mph, many under 0.04 mph (for example 0.01 miles in
  30 minutes). These are meter or GPS errors.
- 252 trips were faster than 65 mph, which is impossible on NYC roads.
- Trips over 60 min had a median speed of **14.8 mph**, so most of them are real.

The new rule: keep trips of **1–180 min** travelling at **1–65 mph**.

**2. Correcting the duplicate finding (2.5).** Across all 20 columns, **0 rows are
identical**. The 52,533 "duplicates" are **refund or reversal pairs**: the same trip
recorded again with the fare negated (for example `+7.90` / `−7.90`), mostly with payment
types 4 (dispute) and 3 (no charge). `clean()` now keeps one row per trip. The errors log
was corrected.

**3. Code:**

- `src/data.py` applies the new duration and speed rules and removes the extra copies.
- The new `src/evaluate.py` adds `segment_metrics()`: RMSE and bias overall, RMSE for trips
  up to and over 60 min, and RMSE by distance range.
- `src/train.py` and `src/tune.py` log those metrics and the cleaning rules for every run.

**4. Data:** 3,310,437 trips kept (95.3%), including 29,330 trips over an hour.

- train: 2,517,854 trips;
- validation: 792,583 trips, of which 7,847 are over 60 min.

**5. Retraining.** The old served model was kept as `artifacts/model_v1_60min.skops`, then
all three models were retrained:

```bash
uv run python -m src.train                                    # served model (all rows)
uv run python -m src.train --train-sample 500000 --run-name rf-baseline \
  --output artifacts/model_baseline.skops
uv run python -m src.tune --n-trials 25
```

### Results (v2 validation week)

| Model | Val RMSE | RMSE ≤ 60 min | RMSE > 60 min | Size | Latency |
|---|---|---|---|---|---|
| Always predict the mean | 11.278 | — | — | — | — |
| Baseline, 500k rows | 4.954 | 4.105 | 28.17 | 254 MB | 17.3 ms |
| Optuna-tuned, 500k rows (same best settings as before) | 4.863 | 4.01 | 27.97 | 1,683 MB | 16.6 ms |
| **Full data (served)** | **4.786** | 3.965 | 27.23 | 740 MB | 16.0 ms |

Tuning is still not worth it: it is 1.8% better than the baseline for a model about
7 times larger.

### v1 vs v2 on the same validation trips

| | v1, 1–60 min | v2, served |
|---|---|---|
| RMSE, all trips | 5.131 | **4.786** (−6.7%) |
| RMSE, trips ≤ 60 min | **3.907** | 3.965 (+1.5%) |
| RMSE, trips > 60 min | 33.65 | **27.23** |
| RMSE, trips of 20–100 mi | 18.11 | **13.43** |
| Highest prediction | 57.0 | 125.1 |

Example requests to the new API: the sample request gives **17.24 min**, JFK → Times
Square gives **52.36 min**, and a 100-mile trip gives **118.69 min** (v1 returned an
impossible 53.5).

**Remaining limitation:** trips over 60 minutes are still underestimated by **about
20 minutes** on average (`bias_val_gt60min = −20.56`). The current features can't explain
those delays. Better features are the next step.

### Notebook (2.9)

The generator script had been deleted along with the temporary folder, so the notebook
is now its own source and was edited directly:

- new cells for the speed check and refund pairs;
- the MLflow table labels each run v1 or v2, using the cleaning rules the run logged;
- a new **section 7** compares v1 and v2 on the same trips;
- updated conclusions.

It was re-run from start to finish with no errors or warnings.

### Tests

4 new tests, for **37 in total, all passing**: long real trips are kept, impossible speeds
are dropped, refund pairs count as one trip, and the segment metrics are correct. The
existing cleaning test was updated, because a 61-minute trip is now valid.

---

## Housekeeping

- **Added to `.gitignore`:**
  - `data/`, the 56 MB raw dataset;
  - `mlflow.db`, the local tracking database;
  - `ruvector.db`, a file created by a Claude Code plugin rather than by the project.
    It was accidentally included in the first commit and then removed from it.
- **Already ignored by the template:** `artifacts/` (the model file) and `mlruns/` (the
  MLflow run artifacts).
- **Commits on `feature/trip-duration-model`:**
  1. `bfeb71d`: Add data prep, features, and baseline RF training with MLflow tracking
  2. `38cf141`: Add FastAPI /predict endpoint with shared model loading
  3. `cf1ba95`: Add pytest suite for data, features, model and API; make model path configurable
  4. `d02306e`: Add Optuna tuning with inner time split; add --output option to training
- **Model files in `artifacts/` (not committed):**
  - `model.skops` is the served v2 model;
  - `model_baseline.skops` and `model_tuned.skops` are the v2 comparison models;
  - `model_v1_60min.skops` is the previous served model, kept for the v1 vs v2
    comparison. It was named `model_fulldata.skops` before.

  The tuned file is 1.6 GB. You can delete it if disk space matters, because it is also
  stored with its MLflow run.

---

## How to Reproduce Everything

```bash
uv sync
uv run pytest -q                              # 37 tests
uv run python -m src.train                    # final model: all training rows (downloads data if missing)
uv run python -m src.tune --n-trials 25       # optional: Optuna search, ~1.5 min
uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000   # inspect runs
uv run uvicorn app.main:app --port 8000       # serve the model
curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d @sample-request.json
```

---

## Step 9: Document Results in the README

**Goal:** record the results, tradeoffs and answers in [README.md](README.md).

Added to the README:

- A **Results** section with:
  - the approach;
  - the four-row model comparison table (mean predictor, baseline, tuned, full data);
  - the verdict on whether tuning was worth it;
  - an example request and its response;
  - answers to both assignment questions.
- **New rows in the file table** for `src/`, `app/`, `tests/`, `sample-request.json` and
  this process log.
- **Updated "Working Locally" commands:** final training with `--train-sample 0`, Optuna
  tuning, and pytest.

Everything is then submitted as a pull request from `feature/trip-duration-model` into
`main`, with the PR template checklist filled in.

## Checklist

- [x] **Steps 1–8.** Data, cleaning, split, baseline, MLflow, shared modules, API, and
      local requests.
- [x] **Stretch: tests.** 22 pytest tests covering data, features, model and API.
- [x] **Stretch: tuning.** A 25-trial Optuna search logged to MLflow.
- [x] **Stretch: comparison.** Tuning gained only 2% for a 7× larger model. Training on
      all the data gained more.
- [x] **Step 9: README.** Results and answers documented:
  1. Final model RMSE: **4.786 min** on the Jan 25–31 validation week, for trips of
     1–180 min. It was 3.958 under v1 cleaning; see "Review Fixes, Step 2".
  2. What I'd do differently: see below. This matches the README.

## What I'd Do Differently

- **Better features rather than more tuning.** Some ideas:
  - the pickup→dropoff zone pair as one feature, or the average historical duration for
    that pair;
  - distance between the zone centres;
  - holiday and weekend flags;
  - weather;
  - airport-trip flags.
- **Try gradient boosting** (`HistGradientBoostingRegressor` or LightGBM). It usually
  beats random forests on tabular data, trains much faster, and produces model files that
  are megabytes rather than gigabytes.
- **Predict the log of duration**, or use an error measure suited to skewed targets. Long
  trips dominate RMSE.
- **Make the model smaller** (fewer or shallower trees), or serve a boosted model. The
  served file is 729 MB at the moment.
- **Package the API in Docker** and use the MLflow Model Registry, so the API loads a
  named model version rather than a file path.
- **Validate the data** with Great Expectations, which is already in the dependencies,
  before training on a new month.
