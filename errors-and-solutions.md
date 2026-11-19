# Errors and Solutions

Every error, warning and unexpected result hit while building the NYC taxi trip-duration
project, with its cause and the fix. The file has two parts:

- **Part 1:** problems that came up during development. All of them are **resolved**
  unless marked otherwise.
- **Part 2:** problems found in a later review that the original 22 tests did not catch.
  **All nine are resolved** on branch `fix/review-findings`: six code bugs, two data
  problems (with the model retrained), and one housekeeping item. There are 15 new tests,
  37 in total.

The step-by-step build history is in [project-processed.md](project-processed.md).

## Summary

| # | Problem | Area | Status |
|---|---|---|---|
| 1.1 | MLflow rejected the `./mlruns` file store | MLflow | ✅ Resolved |
| 1.2 | A plugin file (`ruvector.db`) was committed by accident | Git | ✅ Resolved |
| 1.3 | `httpx` missing for FastAPI's test client | Tests | ✅ No change needed |
| 1.4 | API served the old model after a new one was saved | API | ✅ Resolved |
| 1.5 | `NameError` while generating the notebook | Notebook | ✅ Resolved |
| 1.6 | Correlation table contradicted the leakage explanation | Notebook / analysis | ✅ Resolved |
| 1.7 | pandas deprecation warning for `dt.dayofweek` | Features | ✅ Resolved |
| 1.8 | Monday unexpectedly faster than other weekdays | Analysis | ✅ Explained |
| 1.9 | Port 5000 possibly taken by macOS AirPlay | MLflow | ✅ Checked, not an issue |
| 1.10 | MLflow UI loaded but runs could not be seen | MLflow UI | ✅ Resolved (code fix in 2.7) |
| 1.11 | API and MLflow stopped working after the session ended | Local servers | ✅ Restart commands documented |
| 2.1 | Time-zone-aware pickup times give wrong predictions | API / features | ✅ Resolved |
| 2.2 | Tests and API break when run from another folder | Paths | ✅ Resolved |
| 2.3 | Default training command overwrites the served model with a worse one | Training | ✅ Resolved |
| 2.4 | Trips over 60 min removed, so long trips are underestimated | Data / model | ✅ Resolved (retrained) |
| 2.5 | 52,533 refund/reversal pairs counted as two trips | Data | ✅ Resolved (retrained) |
| 2.6 | Date-only pickup time accepted silently as midnight | API validation | ✅ Resolved |
| 2.7 | MLflow "model training" label set by hand, not in code | MLflow | ✅ Resolved |
| 2.8 | Interrupted download leaves a corrupt data file | Data loading | ✅ Resolved |
| 2.9 | Notebook generator script is not in the repo | Notebook | ✅ Resolved |

---

## Part 1: Problems Hit During Development

### 1.1 MLflow rejected the `./mlruns` file store

**When:** the first training run (`uv run python -m src.train`).

**Error:**

```
mlflow.exceptions.MlflowException: The filesystem tracking backend (e.g., './mlruns') is in
maintenance mode and will not receive further updates. Please migrate to a database backend
(e.g., 'sqlite:///mlflow.db') to access the latest MLflow features.
... set `MLFLOW_ALLOW_FILE_STORE=true` to opt out of this exception.
```

**Cause:** the project template was written for an older MLflow. MLflow 3.17 refuses to
use a plain folder as its tracking store unless you explicitly opt out.

**Solution:**

- Switched to the SQLite backend MLflow recommends. In `src/train.py`:
  `TRACKING_URI = "sqlite:///mlflow.db"`.
- Run artifacts are still stored under `mlruns/`.
- Added `mlflow.db` to `.gitignore`.
- Updated the README command for the MLflow UI:

  ```bash
  uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
  ```

**Why not use the opt-out flag:** the folder store no longer receives updates, and SQLite
needs no extra setup.

---

### 1.2 A plugin file (`ruvector.db`) was committed by accident

**When:** the first commit, made with `git add -A`.

**Symptom:** `git status` showed `A  ruvector.db`, a 1.5 MB file that isn't part of the
project.

**Cause:** a Claude Code plugin creates `ruvector.db` in whatever folder it is working in,
and `git add -A` picked it up.

**Solution:**

```bash
git rm --cached ruvector.db           # remove from git, keep the file on disk
echo "ruvector.db" >> .gitignore
git commit --amend --no-edit
```

The file appeared again later in `notebooks/`. The `.gitignore` rule matches it in any
folder, so it was not committed.

**Lesson:** stage files by name instead of with `git add -A`, or check `git status` before
committing.

---

### 1.3 `httpx` missing for FastAPI's test client

**When:** setting up the API tests.

**Error:**

```
ModuleNotFoundError: No module named 'httpx'
```

**Cause:** this turned out not to be a problem. The installed Starlette/FastAPI version's
`TestClient` uses the newer **`httpx2`** package (`import httpx2 as httpx`), and `httpx2`
is already in the project's dev dependencies.

**Solution:** none needed. `from fastapi.testclient import TestClient` works as it is.

---

### 1.4 API served the old model after a new one was saved

**When:** after the full-data model was made the served model by copying it to
`artifacts/model.skops`.

**Symptom:** the running API still returned the old prediction (17.54 min instead of
16.63).

**Cause:** the API loads the model **once at startup**. This is deliberate, because the
file is hundreds of MB. Replacing the file does not affect an API process that is already
running.

**Solution:** restart the API:

```bash
uv run uvicorn app.main:app --port 8000
```

After the restart, the sample request returned `16.63` and the new `model_version`.

**Rule:** whenever `artifacts/model.skops` changes, restart the API. The `model_version`
field in each response shows which model answered.

---

### 1.5 `NameError` while generating the notebook

**When:** running the script that writes `notebooks/01_eda.ipynb`.

**Error:**

```
NameError: name 'FEATURES' is not defined
```

**Cause:** the generator script used `FEATURES` to write the feature list into a markdown
cell, but never imported it.

**Solution:** added `sys.path.insert(0, ".")` and `from src.features import FEATURES` to
the script, then generated and ran the notebook again.

---

### 1.6 Correlation table contradicted the leakage explanation

**When:** reviewing the executed notebook's leakage check (section 4).

**Symptom:** the notebook text said fare is strongly related to duration, but the table
showed:

| Column | Pearson correlation with duration |
|---|---|
| `trip_distance` | 0.80 |
| `fare_amount` | **0.02** |
| `total_amount` | **0.03** |

**Cause:** bad values in the fare column. After cleaning there are still:

- **126,217 negative fares** (refunds and voided trips);
- one fare of **$863,372**.

Pearson correlation is based on squared deviations, so a few extreme values swamp it.

**Solution:**

- Added **Spearman (rank) correlation** next to Pearson. Ranks aren't thrown off by
  extreme values:

  | Column | Pearson | Spearman |
  |---|---|---|
  | `fare_amount` | 0.02 | **0.87** |
  | `trip_distance` | 0.80 | 0.85 |
  | `total_amount` | 0.03 | 0.83 |

- Added a cell that prints the negative-fare count and the maximum fare.
- Rewrote the explanation. Fare tracks duration *more* closely than distance does,
  because meters charge for time, which is exactly why it would leak.

**Lesson:** check whether a number makes sense before trusting it. On messy data, also
look at a rank-based measure.

---

### 1.7 pandas deprecation warning for `dt.dayofweek`

**When:** running the notebook.

**Warning:**

```
Pandas4Warning: Series.dt.dayofweek is deprecated and will be removed in a future version.
Use Series.dt.day_of_week instead.
```

**Cause:** pandas 3 renamed the attribute. `src/features.py` and the notebook both used the
old name.

**Solution:** replaced `.dt.dayofweek` with `.dt.day_of_week` in both places. The values are
identical, so the trained models are unaffected, and all 22 tests still pass.

---

### 1.8 Monday unexpectedly faster than other weekdays

**When:** the speed-by-day-of-week chart in the notebook.

**Symptom:** Monday's median speed was higher than Tuesday–Friday's, unlike the usual
weekday pattern.

**Investigation:** median speed for each Monday in January:

| Date | Median speed (mph) |
|---|---|
| Jan 6 | 9.82 |
| Jan 13 | 9.76 |
| **Jan 20** | **11.57** |
| Jan 27 | 9.58 |
| *Tuesday–Friday* | *9.19* |

**Cause:** **Monday, Jan 20, 2025 was Martin Luther King Jr. Day.** Holiday traffic was
lighter, which pulls up the Monday average.

**Solution:** this is a data finding, not a bug. It is documented in the notebook. The model
only knows the day of the week, so it can't tell a holiday from a normal Monday. A
**holiday flag** has been added to the list of next features.

---

### 1.9 Port 5000 possibly taken by macOS AirPlay

**When:** before starting the MLflow UI.

**Concern:** on macOS, AirPlay Receiver often listens on port 5000, which stops MLflow from
starting.

**Check:**

```bash
lsof -nP -iTCP:5000 -sTCP:LISTEN     # nothing was listening
```

**Result:** the port was free, and MLflow started normally.

**If it happens to you:** either run MLflow on another port and open that port in the
browser, or turn off AirPlay Receiver under *System Settings → General → AirDrop &
Handoff*.

```bash
uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5001
```

---

### 1.10 MLflow UI loaded but runs could not be seen

**When:** opening http://127.0.0.1:5000 in the browser.

**Symptom:** the user could not see the experiment's runs.

**Investigation:**

- The server was healthy, and the server log showed the browser *was* connecting. The page,
  the experiment list and the run searches all returned `200 OK`.
- The API returned the `nyc-taxi-duration` experiment and all 28 runs.
- The log also showed the UI loading a `demo-tracing-screenshot.png`. MLflow 3 opens on a
  GenAI tracing home page, and an experiment with no type label can open on a **Traces**
  tab instead of **Runs**.

**Solution:**

1. Labelled the experiment as a normal model-training experiment:

   ```python
   from mlflow import MlflowClient
   c = MlflowClient("http://127.0.0.1:5000")
   c.set_experiment_tag("1", "mlflow.experimentKind", "custom_model_development")
   ```

2. Used the direct link to the runs table, with a hard refresh (Cmd+Shift+R):
   **http://127.0.0.1:5000/#/experiments/1/runs**

3. If you click through instead: **Experiments** → **`nyc-taxi-duration`** → the
   **Runs** tab (not Traces). `Default` is an empty experiment MLflow creates on its own.

4. Nothing ran on port 5001. That port was only suggested as a fallback.

**Made permanent:** the label is now set in code every time training or tuning connects to
MLflow, so it survives `mlflow.db` being recreated. See **2.7**.

---

### 1.11 API and MLflow stopped working after the session ended

**Symptom:** http://127.0.0.1:8000 and http://127.0.0.1:5000 stopped responding.

**Cause:** both servers were started as background processes of the Claude Code session,
so they stopped when the session ended.

**Solution:** start them yourself in two terminals, from the project folder:

```bash
uv run uvicorn app.main:app --port 8000                                  # API
uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000     # MLflow
```

Stop either one with **Ctrl+C**.

---

## Part 2: Problems Found in Review

All 22 original tests passed, but probing edge cases turned up the problems below. Each one
lists how it was found, its impact, and its solution.

- **Resolved** on branch `fix/review-findings`: all of 2.1–2.9.
- 2.4 and 2.5 changed the training data, so the model was retrained and the reported RMSE
  changed from 3.958 to **4.786**. See 2.4.

### 2.1 Time-zone-aware pickup times give wrong predictions (bug)

> **Status: ✅ Resolved.** Applied as proposed below. Tests:
> `test_timezone_aware_pickup_converted_to_nyc` (including summer time, UTC-4),
> `test_utc_conversion_can_change_the_day`, and
> `test_utc_pickup_is_converted_to_new_york_time` (API). With the real model,
> `08:30Z` now returns **13.41**, the same as `03:30` New York time.

**How it was found:** sending the same trip with different time formats.

| Request `tpep_pickup_datetime` | Actual New York time | Hour the model used | Prediction |
|---|---|---|---|
| `2025-01-27T08:30:00` | 08:30 | 8 | 16.63 min |
| `2025-01-27T08:30:00Z` (UTC) | **03:30** | **8** ❌ | 16.63 min |
| `2025-01-27T03:30:00` | 03:30 | 3 | 13.41 min |
| `1737966600` (Unix timestamp) | **03:30** | **8** ❌ | 16.63 min |

**Cause:** `prepare_features` takes `.dt.hour` from whatever time zone the input carries.
The model was trained on New York local times, so a UTC input is read as if it were local
time.

**Impact:** silently wrong predictions for any client that sends UTC, which most do.
In this example the error is 3.2 minutes.

**Proposed solution:** in `src/features.py`, convert time-zone-aware times to New York
time, then drop the time zone:

```python
pickup = pd.to_datetime(df["tpep_pickup_datetime"])
if pickup.dt.tz is not None:
    pickup = pickup.dt.tz_convert("America/New_York").dt.tz_localize(None)
```

Add tests showing that `08:30Z`, `03:30-05:00` and a naive `03:30` all give hour 3.

---

### 2.2 Tests and API break when run from another folder (bug)

> **Status: ✅ Resolved.** A new `src/paths.py` defines `PROJECT_ROOT`, `DATA_DIR`,
> `ARTIFACTS_DIR` and `MLFLOW_DB`. Data, model, MLflow, tuning and test paths are all
> built from it. Tests: `test_paths_are_anchored_to_project_root` and
> `test_paths_unchanged_after_changing_directory`. Running `pytest` from `notebooks/`
> now passes all 33 tests, and the API finds the model.

**How it was found:** running the tests and the API from `notebooks/` instead of the
project root.

```
# pytest
FileNotFoundError: [Errno 2] No such file or directory: 'sample-request.json'

# API startup
FileNotFoundError: No model at artifacts/model.skops. Train one first: uv run python -m src.train
```

**Cause:** file paths (`artifacts/model.skops`, `data/...`, `sample-request.json`) are
relative to the folder you run from, not to the project.

**Impact:** a reviewer or IDE that runs from another folder gets failures. The API's
message is also misleading, because the model exists; it is just looking in the wrong
folder.

**Proposed solution:** define the project root once and build every path from it:

```python
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = PROJECT_ROOT / "artifacts" / "model.skops"
```

Apply the same change in `src/data.py`, `src/train.py`, `src/tune.py` and
`tests/test_api.py`, and include the full path in the "no model" error message.

---

### 2.3 Default training command overwrites the served model with a worse one (bug)

> **Status: ✅ Resolved.** Defaults are now `--train-sample 0` (all rows) and
> `--run-name rf-fulldata`. The baseline is reproduced with
> `--train-sample 500000 --run-name rf-baseline --output artifacts/model_baseline.skops`.
> The README and the process log have been updated. Test:
> `test_default_training_is_full_data_to_served_path`.

**How it was found:** reviewing the training command's defaults.

**Cause:** `uv run python -m src.train` defaults to `--train-sample 500000`. That trains
the **baseline** (RMSE 4.105) and saves it to `artifacts/model.skops`, which is the file
the API serves. The deployed model was trained on all the data (RMSE 3.958).

**Impact:** anyone following the earlier instructions downgrades the deployed model
without noticing.

**Proposed solution:**

- Change the default to `--train-sample 0` (all rows), so the plain command produces the
  final model.
- Train the baseline explicitly, saved to a separate file:
  `--train-sample 500000 --output artifacts/model_baseline.skops`.
- Update the README and the process log to match.

---

### 2.4 Trips over 60 min removed, so long trips are underestimated (modelling)

> **Status: ✅ Resolved, model retrained.**
>
> **Applied:**
> - `src/data.py` now keeps trips of **1–180 min** with an average speed of **1–65 mph**.
>   The data showed 12,657 trips under 1 mph (meter or GPS errors) and 252 over 65 mph;
>   trips over 60 min had a median speed of 14.8 mph, so most of them are real.
> - A new `src/evaluate.py` logs RMSE overall, for trips up to and over 60 min, and by
>   distance range, to MLflow for every run.
> - Every run now also logs its cleaning rules.
> - All three models (baseline, tuned, full data) were retrained. The full-data model is
>   served; the old one was kept as `artifacts/model_v1_60min.skops`.
>
> **Result on the same validation trips (792,583, of which 7,847 are over 60 min):**
>
> | | v1, 1–60 min | v2, served |
> |---|---|---|
> | RMSE, all trips | 5.131 | **4.786** |
> | RMSE, trips ≤ 60 min | **3.907** | 3.965 |
> | RMSE, trips > 60 min | 33.65 | **27.23** |
> | RMSE, trips of 20–100 mi | 18.11 | **13.43** |
> | Highest prediction | 57.0 | 125.1 |
> | 100-mile request | 53.55 (impossible) | 118.69 |
>
> **The headline RMSE changed from 3.958 to 4.786.** This is not a worse model: the
> validation set now includes long trips. On the same trips the new model is 6.7% better.
>
> **Partly open:** trips over 60 min are still underestimated by about 20 min on average
> (`bias_val_gt60min = −20.56`). The current features can't explain those delays. The
> fix is new features (zone-pair history, holiday and weather flags), which is listed as
> future work.
>
> **Not done:** limiting the API's `trip_distance`. The model now covers the API's
> 0–100 mi range.
>
> Tests: `test_clean_keeps_long_real_trips`, `test_clean_drops_impossible_speeds` and
> `test_segment_metrics_split_by_duration_and_distance`.

**How it was found:** measuring the served model's error by distance on a 150,000-trip
sample of the validation week, and counting what cleaning removed.

| Distance | Trips | Average error (pred − actual) | RMSE |
|---|---|---|---|
| 0–1 mi | 36,317 | −0.11 min | 2.48 |
| 1–2 mi | 51,021 | −0.31 min | 2.90 |
| 2–5 mi | 41,888 | −0.59 min | 4.32 |
| 5–10 mi | 12,794 | **−0.96 min** | 6.33 |
| 10–20 mi | 7,160 | **−1.04 min** | 7.15 |
| 20–100 mi | 820 | −0.70 min | 6.74 |

- Cleaning removed **29,984 real-looking trips of 60–180 minutes** (median 17.4 miles,
  mostly airport runs).
- The highest prediction in the sample was **55.8 min**.
- A 100-mile request returns **53.55 min**, which is physically impossible.

**Cause:** the target was cut off at 60 minutes, so the model never saw a trip longer than
an hour. It can't predict one, and it is pulled towards shorter durations for long
distances.

**Impact:** long trips are consistently underestimated. The headline RMSE of 3.958 only
covers trips under 60 minutes, so real-world error will be higher.

**Proposed solution:**

- Widen the filter to 1–180 minutes, and keep a speed check (for example 1–80 mph) to
  remove impossible records rather than long ones.
- Retrain and report RMSE overall *and* by distance range.
- Limit the API's `trip_distance` to what the model was trained on, or flag
  out-of-range requests.
- Consider predicting `log(duration)`.

**Note:** this changes the data, so the reported RMSE will change. Update the README, the
process log and the notebook afterwards.

---

### 2.5 52,533 refund/reversal pairs counted as two trips (modelling)

> **Status: ✅ Resolved, model retrained.**
>
> **Correction to the original finding:** these are **not exact duplicate rows**. The
> original check only compared the 6 columns the model loads. Across all 20 columns,
> **0 rows are identical**. The 52,533 extra rows are **refund or reversal records**: the
> same trip recorded again with the fare negated (for example `+7.90` / `−7.90`), mostly
> with payment types 4 (dispute) and 3 (no charge).
>
> **Applied:** `clean()` now keeps one row per trip
> (`drop_duplicates(subset=RAW_COLUMNS)`). Time, zones, distance and passengers are
> identical in both rows of a pair, so it doesn't matter which one is kept. The notebook
> has a new cell that shows the pairs.
>
> Test: `test_clean_keeps_refund_pairs_once`. A pair counts as one trip, and two different
> trips that start at the same second are both kept.
>
> *Original finding, kept for the record:*

**How it was found:** `raw.duplicated().sum()` gives 52,533 identical rows, about 1.5% of
the data. *(This check only covered the 6 loaded columns; see the correction above.)*

**Impact:** the split is by date and identical rows share the same pickup time, so nothing
leaks between training and validation. Duplicated trips do get double weight in training
and in the RMSE.

**Proposed solution:** add `df = df.drop_duplicates()` at the start of `clean()`, plus a
test that duplicate rows are removed. Retrain together with 2.4.

---

### 2.6 Date-only pickup time accepted silently as midnight

> **Status: ✅ Resolved.** A `field_validator` in `app/schemas.py` rejects a bare
> `YYYY-MM-DD` value with HTTP 422: *"must include a time, e.g.
> '2025-01-27T08:30:00'"*. Unix timestamps and full date-times are still accepted.
> Test: `test_date_without_time_rejected`.

**How it was found:** sending `"tpep_pickup_datetime": "2025-01-27"` returns **200** with
**10.82 min**, the midnight prediction, instead of an error.

**Proposed solution:** in `app/schemas.py`, add a validator that rejects values without a
time (return 422 with a clear message), and add a test for it.

---

### 2.7 MLflow "model training" label set by hand, not in code

> **Status: ✅ Resolved.** Applied as proposed below. `setup_mlflow()` also now takes an
> optional tracking URI, so a test can check it against a temporary database. Test:
> `test_setup_mlflow_labels_experiment`.

**Follows from:** 1.10.

**Impact:** if `mlflow.db` is deleted or recreated, the runs are hidden behind the Traces
view again.

**Proposed solution:** set the label every time training or tuning connects to MLflow, in
`setup_mlflow()` in `src/train.py`:

```python
mlflow.set_experiment_tag("mlflow.experimentKind", "custom_model_development")
```

---

### 2.8 Interrupted download leaves a corrupt data file

> **Status: ✅ Resolved.** A new `download()` function in `src/data.py` writes to
> `<file>.parquet.part`, renames it only when the download completes, and always
> removes a leftover `.part` file. Tests: `test_interrupted_download_leaves_no_file`
> and `test_successful_download_lands_at_target`.

**How it was found:** reviewing `load_raw()` in `src/data.py`.

**Cause:** `urllib.request.urlretrieve` writes straight to
`data/yellow_tripdata_2025-01.parquet`. If the download stops halfway, the partial file
stays there. Because the file "exists", it is never downloaded again, and every later run
fails while reading it.

**Proposed solution:** download to a temporary `.part` file and rename it only when the
download is complete:

```python
tmp = path.with_suffix(".part")
urllib.request.urlretrieve(DATA_URL, tmp)
tmp.replace(path)
```

---

### 2.9 Notebook generator script is not in the repo

> **Status: ✅ Resolved.** The second option was chosen: **the notebook is now its own
> source.** The temporary generator script had already been deleted when the temporary
> folder was cleared, so `notebooks/01_eda.ipynb` was edited directly for the v2 update.
> Edits made:
> - new cells for the speed check and refund pairs;
> - the MLflow table now labels each run v1 or v2;
> - a new section 7 compares v1 and v2 on the same trips;
> - updated conclusions.
>
> The notebook was then re-run from start to finish with no errors or warnings.

**Cause:** `notebooks/01_eda.ipynb` was written by a script kept in a temporary folder
outside the project.

**Impact:** low. The notebook is complete and can be edited and re-run directly in
Jupyter or VS Code. The script just can't be re-run to regenerate it.

**Proposed solution:** either add the script as `scripts/build_eda_notebook.py`, or treat
the notebook itself as the source from now on and edit it directly. The second option is
simpler.

---

## Order for Fixing the Problems

1. ✅ **Code bugs, which leave the model unchanged:** 2.1, 2.2, 2.3, 2.6, 2.7, 2.8. Done on
   branch `fix/review-findings`, with 11 new tests (33 in total).
2. ✅ **Data changes, which require retraining:** 2.4 and 2.5 together. All three models
   were retrained, and the README, `project-processed.md` and the notebook were updated
   (RMSE 3.958 → 4.786 on the wider validation set).
3. ✅ **Housekeeping:** 2.9.
