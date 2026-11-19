# Model Deployment Project

Use this repository as a **template** for your model deployment project. You will train a regression model that predicts the duration of NYC Yellow Taxi trips, track your experiments locally with MLflow, and serve predictions through a FastAPI app on your own machine. Create pull requests in your own copy even if you are working alone, and use them to track your progress.

## Learning Objectives

By the end of this repository, you should be able to:

- Build an end-to-end regression workflow for real-world taxi trip data.
- Separate exploration, preprocessing, training, and serving concerns into maintainable code.
- Track experiments locally with MLflow and compare model runs.
- Serve model predictions through a local API.

## Learning Path

```mermaid
flowchart LR
    A["Download<br>Yellow Taxi data"] --> B["Explore and clean<br>features"]
    B --> C["Train Random Forest<br>Regressor"]
    C --> D["Track runs<br>in MLflow"]
    D --> E["Package preprocessing<br>and model"]
    E --> F["Serve predictions<br>with FastAPI"]
    F --> G["Send local<br>test request"]
```

| File / Folder | Description |
|---|---|
| [**Project Description**](project-description.md) | The assignment tasks, suggested workflow, repository layout, and stretch goals. |
| [**Process Log**](project-processed.md) | Every step taken, with commands, decisions, problems hit and results. |
| [**Errors and Solutions**](errors-and-solutions.md) | Every error and unexpected result, its cause, and how it was fixed. |
| [**notebooks/01_eda.ipynb**](notebooks/01_eda.ipynb) | EDA (data quality, cleaning rules, drivers of duration, leakage check, MLK Day finding) and the model comparison read from MLflow. |
| [**src/**](src/) | Data loading and cleaning (`data.py`), shared features (`features.py`), model loading (`model.py`), training (`train.py`), Optuna tuning (`tune.py`). |
| [**app/**](app/) | FastAPI app (`main.py`) and request/response schemas (`schemas.py`). |
| [**tests/**](tests/) | 37 pytest tests for cleaning, features, evaluation, model, API, paths and training defaults. |
| [**sample-request.json**](sample-request.json) | An example `/predict` request body. |

### Additional Folders and Files

| File / Folder | Description |
|---|---|
| [**pyproject.toml**](pyproject.toml) | Project configuration, dependencies and pytest settings. |
| [**uv.lock**](uv.lock) | Dependency lock file. |

## Results

### Approach

- **Data:** NYC Yellow Taxi trips from January 2025, 3.48M raw trips.
  - The target is `duration`, meaning dropoff minus pickup, in minutes.
- **Cleaning (v2):**
  - Keep trips of **1–180 min** with an average speed of **1–65 mph** and a distance
    above 0 and at most 100 miles, picked up in January.
  - Count **refund and reversal pairs** once: the same trip recorded again with a negated
    fare.
  - That leaves **3.31M trips** (95.3%).
  - The first version (v1) kept only 1–60 min trips, which dropped about 30,000 real long
    trips. See [errors-and-solutions.md](errors-and-solutions.md), item 2.4.
- **Features:** only what is known when a trip starts: pickup and dropoff zones, trip
  distance, passenger count, pickup hour and day of week. Pickup times that include a
  time zone are converted to New York time first. Fare, tip and total are excluded,
  because they are only known after the trip and would leak the answer.
- **Split by time:**
  - train on Jan 1–24 (2.52M trips);
  - validate on Jan 25–31 (792,583 trips, of which 7,847 are over 60 min).
- **Model:** `RandomForestRegressor`. Runs are tracked in MLflow under the experiment
  `nyc-taxi-duration`. Each run logs RMSE overall, for trips up to and over 60 minutes,
  and by distance range.

### Model comparison (v2 data, validation week Jan 25–31)

| Model | Training rows | Val RMSE (min) | RMSE, trips ≤ 60 min | RMSE, trips > 60 min | Model size | Latency per request |
|---|---|---|---|---|---|---|
| Always predict the training average | — | 11.278 | — | — | — | — |
| Baseline (50 trees, depth 20, min leaf 5) | 500k | 4.954 | 4.105 | 28.17 | 254 MB | 17.3 ms |
| Optuna-tuned (150 trees, depth 26, min leaf 3, max_features 0.5) | 500k | 4.863 | 4.01 | 27.97 | 1,683 MB | 16.6 ms |
| **Baseline settings on all training data (served)** | **2.52M** | **4.786** | 3.965 | 27.23 | 740 MB | 16.0 ms |

Latency is the median of 30 single-trip predictions with the model already loaded.

**Was tuning worth it?**

- **No.** Optuna ran 25 trials, each scored on Jan 18–24 so the final validation week was
  never used to choose settings.
  - It gained **1.8%** over the baseline.
  - Its model file is **almost 7 times larger**.
- **Training the plain baseline on all the data did better** (3.4% better than the
  baseline), with less than half the tuned model's file size.
- This is the same conclusion as with the v1 data: the amount of data and the quality of
  the features matter more than hyperparameters here.

### v1 vs v2 cleaning, on the same validation trips

The v1 RMSE (3.958) only covered trips of 1–60 minutes, so it can't be compared with the
v2 figure above. Both served models were therefore scored on the same v2 validation week:

| Validation trips (792,583) | v1, trained on 1–60 min | **v2, served** |
|---|---|---|
| RMSE, all trips | 5.131 | **4.786** |
| RMSE, trips ≤ 60 min | **3.907** | 3.965 |
| RMSE, trips > 60 min | 33.65 | **27.23** |
| RMSE, trips of 20–100 mi | 18.11 | **13.43** |
| Highest prediction | 57.0 min | 125.1 min |

- v2 is **6.7% better overall** and much better on long trips, for a **1.5%** cost on
  trips up to an hour.
- **Remaining limitation:** trips over 60 minutes are still underestimated by **about
  20 minutes** on average. Zone, distance and time can't see crashes, closures or
  weather.

### Example request

```bash
curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d @sample-request.json
# {"duration_minutes":17.24,"model_version":"rf-20261119154228"}
```

| Request | Prediction |
|---|---|
| Sample: zone 161 → 236, 2.5 mi, Monday 8:30am | 17.24 min |
| JFK (132) → Times Square (230), 17.5 mi, Tuesday 5:30pm | 52.36 min (v1: 48.8) |
| 100 mi | 118.69 min (v1: an impossible 53.5) |

- **Invalid input** returns HTTP 422 with a message naming the field: for example
  `PULocationID: 999`, or a date with no time such as `"2025-01-27"`.
- **Time zones:** UTC times such as `"...08:30:00Z"` are converted to New York time.

### Answers

**1. What is the RMSE of your final model?**

**4.786 minutes** on the held-out final week of January (Jan 25–31, 792,583 trips of
1–180 min). The model is a random forest with 50 trees, max depth 20 and min leaf 5,
trained on all 2.52M training trips. For comparison, always predicting the average trip
gives 11.278.

- On trips **up to 60 minutes**, the RMSE is **3.965**.
- An earlier version reported **3.958**. That figure only covered trips under an hour,
  because longer trips had been removed from the data. On the same validation trips as
  the final model, that earlier model scores 5.131.

**2. What would you do differently if you had more time?**

- **Better features, especially for long trips,** which are still underestimated by about
  20 minutes. Examples:
  - the pickup→dropoff zone pair, or the average historical duration for that pair;
  - distance between zone centres;
  - holiday flags (MLK Day was visibly faster), airport and rush-hour flags;
  - weather and incident data.
- **Try gradient boosting** (`HistGradientBoostingRegressor` or LightGBM). It is usually
  more accurate on tabular data, trains faster, and produces model files measured in
  megabytes rather than the forest's hundreds of megabytes.
- **Model `log(duration)`,** or use a loss that cares about relative error. Long trips
  dominate RMSE, so it is also worth reporting MAE and segment metrics alongside it.
- **Shrink the served model.** At 740 MB it is heavy to ship.
- **Load the model from the MLflow Model Registry** rather than a file path, and package
  the API in Docker.
- **Validate each new month's data** with Great Expectations before retraining, and
  monitor drift (for example February traffic patterns) against the January baseline.

## Setup

Use [uv](https://docs.astral.sh/uv/getting-started/installation/) 0.13.5 or newer
and Python 3.13.17 or a newer 3.13 patch release, as defined in
[`.python-version`](.python-version).

> [!NOTE]
> Throughout these steps, text in angle brackets like `<repo-name>` is a **placeholder**. Replace it, including the `< >` brackets, with your own value. For example, `cd <repo-name>` becomes `cd mle-model-deployment-project`.

### 1. Create the Repository from the Template

Click **Use this template** on GitHub.

When creating the repository:

- Set yourself as the **Owner**
- Choose a repository name
- Disable **Include all branches**
- Click **Create repository**

> [!IMPORTANT]
> If you are working in pairs or groups, only **one person** should complete this step.

---

### 2. Add Collaborators (Pairs/Groups Only)

If working with teammates:

1. Open the repository on GitHub
2. Go to **Settings → Collaborators**
3. Add your teammates as collaborators
4. Share the repository link with your team

Teammates should accept the invitation before continuing.

---

### 3. Clone the Repository

Copy the SSH URL from the **Code** button on GitHub, then run:

```bash
git clone <copied-ssh-url>
```

The copied SSH URL will look like `git@github.com:<your-username>/<repo-name>.git`.

---

### 4. Move into the Project Folder and Install Dependencies

This installs all dependencies and creates a virtual environment in `.venv/`.

```bash
cd <repo-name>
uv sync
```

---

### 5. Open the Repository in VS Code

> [!NOTE]
> Make sure you open VS Code from the project root so it automatically detects the environment created by `uv sync`.

Launch VS Code in the project root folder:

```bash
code .
```

If you create a notebook to explore the data, select the Python environment created by `uv sync` as the kernel.

## How to Use This Repo

1. Read the assignment brief in [project-description.md](project-description.md).
2. Download and inspect the January 2025 Yellow Taxi dataset.
3. Train a baseline `RandomForestRegressor` and track runs locally with MLflow.
4. Refactor preprocessing and training logic into reusable Python modules.
5. Build a local prediction API with FastAPI.
6. Send a test request to the API and document the outcome in your README or PR.

### Working Locally

Once you have implemented the project code, a typical local workflow looks like this:

1. Train the model and log runs to MLflow. Runs are stored in `mlflow.db` and `mlruns/`,
   and the data downloads automatically if it is missing.

   ```bash
   uv run python -m src.train                    # final model: all training rows, saved to artifacts/model.skops
   uv run python -m src.tune --n-trials 25       # optional: Optuna search (~1.5 min)
   uv run pytest -q                              # run the tests
   ```

2. Start the tracking UI:

   ```bash
   uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
   ```

3. Run the API locally:

   ```bash
   uv run uvicorn app.main:app --reload --port 8000
   ```

4. Send a request to the API:

   ```bash
   curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d @sample-request.json
   ```

The `app/` package and `sample-request.json` are files you create during the project. Make the sample request match your `/predict` input schema before running the commands above.
