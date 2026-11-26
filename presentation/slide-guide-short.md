# Slide Guide: Short Deck (6 slides)

This guide goes with [nyc-taxi-trip-duration-short.pdf](nyc-taxi-trip-duration-short.pdf) and [nyc-taxi-trip-duration-short.pptx](nyc-taxi-trip-duration-short.pptx). It is a condensed version of the 15-slide deck; the full deck has its own guide in [slide-guide.md](slide-guide.md).

**Talk length:** about 6–8 minutes, roughly 1 minute per slide plus questions.

**How to use this guide:** each slide has four parts:

- **On the slide:** what the audience sees.
- **What to say:** a script you can read or paraphrase. The same text is in the speaker notes of the .pptx.
- **Details behind the numbers:** where each figure comes from, so you can answer follow-ups.
- **Likely questions:** short answers to questions you may be asked.

| # | Slide | Covers |
|---|---|---|
| 1 | Predicting NYC Taxi Trip Duration | The problem, the tools and the headline result |
| 2 | From raw trips to a live API | The pipeline, the features (and leakage) and the time-based split |
| 3 | 3.48M messy trips, cleaned by rules | Data problems and the cleaning rules |
| 4 | More data beat tuning | Model comparison, tuning, v1 vs v2 and what drives duration |
| 5 | Tracked, served and tested | MLflow, FastAPI, tests and the code review |
| 6 | Final RMSE and what's next | The two README answers and how to run it |

---

## Slide 1: Predicting NYC Taxi Trip Duration

**On the slide**
- Title, with a one-line problem statement: given a trip at pickup, predict its duration in minutes and serve the prediction over HTTP.
- The tools: scikit-learn, MLflow, FastAPI, pytest and Optuna.
- A large callout: **4.79 minutes RMSE** on the held-out final week. Below it: 3.31M clean trips, 37 tests, 3 merged PRs.

**What to say**
> "This project predicts how long a New York yellow-taxi ride will take, using only what is known when the ride starts. I trained a Random Forest on January 2025 trips, tracked every experiment in MLflow, served the model with FastAPI, and covered it with 37 tests. The final model is off by about 4.8 minutes on the last week of January, which it never saw during training."

**Details behind the numbers**
- **4.79** is the rounded RMSE of the served model (exactly 4.786), measured on Jan 25–31.
- **3.31M** is the 3,310,437 trips left after cleaning, out of 3,475,226 raw trips.
- **37 tests** run with `uv run pytest -q`.
- **3 merged PRs:**
  - #1 is the main build.
  - #2 holds the review fixes and the retraining.
  - #3 adds a documentation note.

**Likely questions**
- *What does RMSE mean?* It is root mean squared error: the typical size of a prediction error, in minutes. Large errors are weighted more heavily than small ones.
- *Is 4.79 minutes good?* Predicting the average duration for every trip gives 11.28, so the model cuts the error by about 58%.

---

## Slide 2: From raw trips to a live API

**On the slide**
- **Six pipeline steps**, each with the file that implements it:
  - Download and Clean: `src/data.py`
  - Features: `src/features.py`
  - Train: `src/train.py`
  - Track: `mlflow.db`
  - Serve: `app/main.py`
- **Left card:** the 6 features, all known at pickup, plus the excluded columns and why they are excluded.
- **Right side:** a January timeline:
  - Train on Jan 1–24 and validate on Jan 25–31.
  - Optuna tuning was scored on Jan 18–24.

**What to say**
> "Six stages, one module each. Training and the API call the same `prepare_features()` function, so serving can never prepare inputs differently from training. The model uses six fields that exist when the ride starts. Fare and tip are left out because they're only known afterwards and would leak the answer. The split is by date: train on January 1 to 24, validate on 25 to 31. That mimics real use, which is always predicting the future."

**Details behind the numbers**
- **Features:**
  - `PULocationID` and `DOLocationID` are taxi zone IDs from 1 to 265.
  - `trip_distance` is in miles.
  - `passenger_count`: missing values are filled with 1.
  - `pickup_hour` and `pickup_dow` come from the pickup time. If a timestamp has a time zone (for example UTC), it is converted to New York time first.
- **Leakage:**
  - Fare has a Spearman (rank) correlation of **0.87** with duration, higher than distance (0.85). Taxi meters charge for time, so fare effectively contains the answer.
  - Pearson correlation showed only 0.02 because a single $863,372 fare distorted it.
- **Split sizes:** 2,517,854 training trips and 792,583 validation trips.
- **Optuna:**
  - Trained on Jan 1–17 and scored on Jan 18–24, all inside the training period.
  - The final week was therefore used only once, for the final score.

**Likely questions**
- *Why not a random split?* Trips from the same day (same weather, same events) would land on both sides, which makes the score look better than it is. A date split tests what happens in practice: predicting days the model has never seen.
- *Why is distance allowed? It's the meter distance at the end of the trip.* In the dataset, yes. At prediction time it stands in for the route distance that a booking or navigation app would estimate at pickup. This is an assumption worth stating openly.

---

## Slide 3: 3.48M messy trips, cleaned by rules

**On the slide**
- **Four data problems:**
  - 3,475,226 raw trips;
  - a "shortest trip" of −51,472 minutes;
  - 15.5% of rows missing a passenger count;
  - 52,533 refund pairs.
- **Five cleaning rules**, each with a one-line reason.
- **A bar** showing that 95.3% of trips were kept (3,310,437).

**What to say**
> "Real data is messy: negative and multi-day durations, distances of hundreds of thousands of miles, 15 percent missing passenger counts, and 52,533 trips recorded twice because of refunds. Each rule came from looking at the data. Trips over an hour have a median speed of about 15 mph, so most of them are real. That's why the rules keep trips up to 180 minutes and use a speed check to remove broken records. 95.3 percent of trips survive."

**Details behind the numbers**
- **Extremes in the raw data:**
  - the longest trip lasted 5,626 minutes (about 4 days);
  - the largest distance was 276,424 miles;
  - fares ranged from −$900 to $863,372.
- **Duration 1–180 min:** removes clock errors and meters left running, but keeps genuine long airport runs.
- **Speed 1–65 mph:**
  - below 1 mph usually means the meter or GPS was faulty (12,657 trips);
  - above 65 mph is not realistic in NYC.
- **Refund pairs:**
  - A refund adds a second record of the same trip. It has the same pickup time, zones, distance and passengers, but a negated fare (for example +7.90 and −7.90).
  - The cleaning keeps one row per trip. Rows are matched on the six columns the model uses; across all 20 columns, no two rows are identical.
- **Removed in total:** 164,789 trips (4.7%).

**Likely questions**
- *Why 180 minutes and not 60?* The first version (v1) cut at 60 minutes and dropped about 30,000 real long trips, so the model could never predict more than 57 minutes. A code review caught this. Slide 4 shows the effect of the fix.
- *Why fill missing passenger counts with 1?* It is the most common value. Passenger count also matters little to the model (0.2% importance), so the choice has almost no effect.

---

## Slide 4: More data beat tuning

**On the slide**
- **RMSE for four models** (lower is better):

  | Model | RMSE | Notes |
  |---|---|---|
  | Mean predictor | 11.278 | |
  | Baseline forest | 4.954 | 500k rows |
  | Optuna-tuned forest | 4.863 | 500k rows, 1,683 MB |
  | Baseline settings, all data | **4.786** | 2.52M rows; the served model |

- **"Was tuning worth it? No.":** a 1.8% gain for a file 6.6× larger. Using all the data gave −3.4%.
- **v1 → v2 on the same 792,583 trips:** all trips 5.13 → 4.79; trips over 60 min 33.65 → 27.23.
- **Bottom line:** distance is 84% of feature importance; traffic explains the rest.

**What to say**
> "All the forests beat the naive mean predictor by more than half. Tuning with Optuna improved the error by under 2 percent but made the model almost seven times bigger. Simply training on all the data did better, so that's the model being served, with an RMSE of 4.786. The first version cut trips at 60 minutes and reported a flattering 3.96. After keeping long trips, the new model is better on exactly the same trips, though trips over an hour are still underestimated by about 20 minutes."

**Details behind the numbers**
- **Baseline settings:** 50 trees, max depth 20, min samples per leaf 5, all features considered at each split.
- **Optuna:** 25 trials with the TPE sampler. It found deeper trees, which explains the much bigger file (1,683 MB vs 254 MB).
- **Size of each improvement:**
  - Tuning: (4.954 − 4.863) / 4.954 ≈ 1.8%.
  - All data: (4.954 − 4.786) / 4.954 ≈ 3.4%.
- **v1 vs v2 on the same trips:**
  - v2 is 6.7% better overall and much better on long trips.
  - v2 is slightly worse on trips of 60 minutes or less: 3.91 → 3.97 (+1.5%).
  - Trips of 20–100 miles: 18.11 → 13.43.
  - The largest prediction rose from 57 to 125 minutes.
- **Bias on trips over 60 min:** −20.56 minutes. The model predicts these trips about 20 minutes too short.
- **Feature importance:**

  | Feature | Share |
  |---|---|
  | Distance | 84.0% |
  | Pickup hour | 5.6% |
  | Dropoff zone | 4.3% |
  | Pickup zone | 3.8% |
  | Day of week | 2.1% |
  | Passengers | 0.2% |

- **Median speed:** highest at 5am (15.9 mph), lowest around 2pm (8.5 mph).

**Likely questions**
- *If v1 scored 3.96, why is v2 "better" at 4.79?* The two numbers were measured on different trips. v1 was scored only on trips of 60 minutes or less, which are easy. On the same set of trips, v2 wins (5.13 → 4.79).
- *Why are long trips still underestimated?* Delays from crashes, weather or events are not in the features. The model sees only distance, zones and time.
- *Why not serve the tuned model?* It is less accurate than the all-data model and 2.3× bigger (1,683 MB vs 740 MB).

---

## Slide 5: Tracked, served and tested

**On the slide**
- **MLflow:** 56 runs logged. It records parameters, RMSE by segment, bias and the model file. Tracking uses an SQLite backend, and the experiment is tagged so the new UI shows its runs.
- **FastAPI:** three endpoints (`GET /health`, `POST /predict`, `GET /docs`).
  - A sample prediction: 2.5 mi on Monday at 8:30am gives 17.24 min.
  - Bad input returns 422.
  - UTC times are converted to New York time.
  - Each call takes about 16 ms.
- **Tests:** 37 tests, passing in about 1.5 s. A review found 9 bugs the first 22 tests missed; four are listed on the slide.

**What to say**
> "MLflow records every run's settings, metrics and model, 56 runs in total; two quirks of MLflow 3.17 were fixed in code. The FastAPI app validates input, converts UTC times to New York time to match training, and answers in about 16 milliseconds. Testing went beyond 'it passes': after the first 22 tests passed, a review found nine real bugs, including UTC handling and the 60-minute cutoff. Each fix added a test, giving 37."

**Details behind the numbers**
- **MLflow:**
  - Runs are stored in `mlflow.db` and viewed with `uv run mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000`.
  - MLflow 3.17 rejects the old `./mlruns` folder store.
  - The new UI hid the runs until the experiment was tagged `mlflow.experimentKind=custom_model_development`, which is now set in `src/train.py`.
  - The 56 runs include two 25-trial Optuna searches, logged as nested runs.
- **Model format:** saved with skops, a safe format, rather than pickle.
- **API:**
  - The model is loaded once, at startup (FastAPI lifespan).
  - Input is validated by pydantic:
    - zone IDs 1–265;
    - distance greater than 0 and at most 100;
    - passengers 0–9;
    - a date with no time is rejected.
  - `GET /` returns 404 by design; use `/docs` to try it.
- **The nine review fixes:**
  1. UTC times were read as local time.
  2. Paths broke when the code ran outside the project root.
  3. The default training command overwrote the best model with a weaker one.
  4. Date-only input was accepted.
  5. The 60-minute cutoff hid long trips.
  6. Impossible speeds were kept.
  7. Refund pairs were counted twice.
  8. An interrupted download left a broken file.
  9. MLflow runs were mislabelled, so the UI hid them.

  All nine are documented in `errors-and-solutions.md`.

**Likely questions**
- *How do you know the tests catch real bugs?* The time-zone and date-only tests were checked to fail without their fixes.
- *Why is the model 740 MB?* A Random Forest stores every tree in full, so file size grows with the number of rows and the tree depth. Gradient boosting would be much smaller (see slide 6).

---

## Slide 6: Final RMSE and what's next

**On the slide**
- **Answer 1:** the final RMSE is **4.786 min** on Jan 25–31 (792,583 trips). It is 3.97 for trips up to an hour; the mean predictor scores 11.28.
- **Answer 2, with more time:**
  - better features;
  - gradient boosting;
  - a better target (log duration, plus MAE);
  - a production path.
- **Three commands** to install, test, train and serve.

**What to say**
> "The assignment asks two questions. The final RMSE is 4.786 minutes on the held-out last week of January. With more time, the biggest win would be features that explain long, slow trips. Then gradient boosting, which is usually more accurate and far smaller than a 740 MB forest. Then packaging for production. The last three commands are all it takes to reproduce everything on one machine."

**Details behind the numbers**
- **Better features:**
  - The average past duration for each pickup and dropoff zone pair.
  - A holiday flag: MLK Day (Jan 20) ran at 11.6 mph, against about 9.7 on other Mondays.
  - Weather data.
- **Gradient boosting:** LightGBM or XGBoost usually beat Random Forests on tabular data, and their model files are measured in MB.
- **Better target:** trip durations are right-skewed, so predicting log(duration) reduces the pull of long outliers. MAE is easier to explain than RMSE ("off by X minutes on average").
- **Production path:**
  - a Docker image;
  - the MLflow Model Registry, instead of a file path;
  - monthly checks that new data still looks like the training data.
- **Commands:**
  1. `uv sync && uv run pytest -q` installs dependencies and runs the 37 tests.
  2. `uv run python -m src.train` trains on all data and logs to MLflow. It needs the January parquet file, which is downloaded automatically.
  3. `uv run uvicorn app.main:app --port 8000` serves the model; then open http://127.0.0.1:8000/docs.

**Likely questions**
- *Which single change would help most?* Features for long trips. That segment has the largest errors (27 min RMSE) and a clear bias.
- *Can I try it without training?* Only if `artifacts/model.skops` already exists. The model files are not in git because of their size.

---

## Rebuilding the deck

The deck is generated by [build_deck_short.js](build_deck_short.js), which uses pptxgenjs, react-icons and sharp. To change a number, edit the script, then:

```bash
NODE_PATH=/path/to/node_modules node build_deck_short.js
# then open the .pptx in Keynote or PowerPoint and export as PDF
```

All charts are drawn with shapes rather than native chart objects, because Keynote drops native charts when it converts .pptx.
