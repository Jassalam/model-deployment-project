# Slide Guide: Predicting NYC Taxi Trip Duration

A detailed explanation of each of the 15 slides in
[nyc-taxi-trip-duration.pptx](nyc-taxi-trip-duration.pptx) (and the
[PDF](nyc-taxi-trip-duration.pdf)). Each slide has:

- **What the slide shows:** the elements on screen, so you know what the audience is
  looking at.
- **What to say:** a suggested explanation, in plain language.
- **Details behind it:** the numbers and decisions in more depth, in case you are asked.
- **Likely questions:** questions you may get, with short answers.

**Timing:** about 1 minute per slide gives a 15-minute talk. If you need to cut, slides
11 (MLflow) and 15 (run it) are the easiest to shorten.

---

## Slide 1: Title

**What the slide shows**

- The title "Predicting NYC Taxi Trip Duration".
- A subtitle: train, track and serve a Random Forest, then review it and fix what the tests
  missed.
- A stat card on the right: **4.79** minutes RMSE on the held-out final week, plus
  3.31M trips, 37 tests and 3 merged pull requests.
- Checkerboard strips at the top and bottom: a nod to the classic NYC taxi stripe.

**What to say**

> "This project predicts how long a New York yellow-taxi ride will take, using only what we
> know when the ride starts. I trained a Random Forest on January 2025 trips, tracked every
> experiment in MLflow, and served the model through a FastAPI endpoint. On the last week
> of January, which the model never saw during training, it is off by about 4.8 minutes on
> average."

**Details behind it**

- **RMSE** (root mean squared error) is the typical size of a prediction error, in
  minutes. Big misses count extra, because errors are squared before averaging.
- **4.79** is rounded from **4.786**.
- "Held-out final week" means Jan 25–31. Those trips were never used for training or for
  choosing settings.
- **3 merged pull requests:**
  - PR #1 was the original project;
  - PR #2 fixed nine issues found in review;
  - PR #3 was a documentation note.

**Likely questions**

- *Is 4.79 minutes good?* Always guessing the average trip length gives 11.28 minutes of
  error, so the model cuts the error by about 58%. Slide 10 shows where the error comes
  from: mostly very long trips.

---

## Slide 2: The goal

**What the slide shows**

- On the left: the **input** (pickup and dropoff zone, distance, pickup time, passengers),
  the **output** (minutes, returned by an API), and **why** only these fields are used.
- On the right: four tool cards, for scikit-learn, MLflow, FastAPI, and pytest with Optuna.

**What to say**

> "The task is to train and locally deploy a model that predicts trip duration. The key
> constraint is timing: someone asks for a prediction when the ride starts, so the model
> can only use information available at that moment. The required tools were
> scikit-learn, MLflow and FastAPI. Tests and hyperparameter tuning were stretch goals,
> and I did both."

**Details behind it**

| Tool | What it does here |
|---|---|
| scikit-learn | Trains the `RandomForestRegressor`. |
| MLflow | Records every training run: settings, scores and model file. |
| FastAPI | Turns the model into a web service with a `/predict` endpoint. |
| pytest | Runs 37 automated tests. |
| Optuna | Searches for better model settings (hyperparameters). |

- The data is the official **NYC TLC Yellow Taxi trip records** for January 2025.
- The prediction target is `duration` = dropoff time minus pickup time, in minutes.

**Likely questions**

- *Why a Random Forest?* The assignment required it. It's a good choice for tabular data:
  it handles a mix of features with no scaling and is hard to break.
- *Why not use the fare?* It's only known after the ride. See slide 6.

---

## Slide 3: The pipeline

**What the slide shows**

- Six numbered cards connected left to right: **Download → Clean → Features → Train →
  Track → Serve**.
- Each card has an icon, a one-line description, and the file where that step lives.
- Below them, a sentence about the shared feature function.

**What to say**

> "The project is six steps, each in its own file. Data is downloaded, cleaned, and turned
> into features. Then the model is trained, the run is recorded in MLflow, and the API
> serves it. The most important design choice is the shared feature step: training and
> the API call the exact same function, so the model always sees inputs prepared the same
> way."

**Details behind it**

| Step | File | Notes |
|---|---|---|
| Download | `src/data.py` | Downloads the 56 MB parquet file once. It writes to a temporary `.part` file and renames it only when complete, so an interrupted download can't leave a broken file. |
| Clean | `src/data.py` | The rules are on slide 5. |
| Features | `src/features.py` | `prepare_features()`, used by both training and the API. |
| Train | `src/train.py` | Random Forest with a time-based split (slide 8). |
| Track | `mlflow.db` | Local SQLite database for MLflow (slide 11). |
| Serve | `app/main.py` | FastAPI app (slide 12). |

- **Training/serving skew** is a classic production bug: the model is trained on data
  prepared one way and served data prepared another way. Sharing one function prevents
  it. A real example appeared in this project: the API's time-zone handling had to match
  training exactly (slide 13).

**Likely questions**

- *How do you run it?* Slide 15 has the six commands.

---

## Slide 4: The data

**What the slide shows**

- Four stat cards:
  - **3,475,226** raw trips;
  - **−51,472** minutes for the "shortest" trip (in red);
  - **15.5%** of rows missing passenger count;
  - **52,533** refund pairs (in red).
- A paragraph of other surprises.

**What to say**

> "Real-world data is messy. There are 3.5 million trips in January, but some have
> impossible values: negative durations, trips lasting four days, distances of a quarter of
> a million miles. Fifteen percent have no passenger count. And about 52 thousand trips
> appear twice: once normally and once as a refund with the fare made negative. All of
> this had to be handled before training."

**Details behind it**

- The file has **20 columns**. Only 6 are loaded for the model.
- **Duration problems:**
  - 124 negative durations (clock errors);
  - 40,111 trips under 1 minute;
  - a maximum of **5,626 minutes** (about 4 days, a meter left running);
  - 20 trips over 24 hours.
- **Distance problems:**
  - 90,893 trips with zero distance;
  - 162 trips over 100 miles;
  - a maximum of **276,424 miles**.
- **Missing values:** the same **540,149 rows** (15.5%) lack `passenger_count`,
  `RatecodeID`, `store_and_fwd_flag`, `congestion_surcharge` and `Airport_fee`. Only
  `passenger_count` is a feature; missing values are filled with 1, the most common value.
- **Fares**, among trips that passed the first cleaning: from −$900 to **$863,372**,
  including 126,217 negative fares (refunds and voids).
- **Refund pairs:**
  - Two rows share the same pickup time, dropoff time, zones, distance and passengers, but
    the fare is negated (for example +$7.90 and −$7.90).
  - They are mostly payment type 4 (dispute) and 3 (no charge).
  - No two rows are identical across all 20 columns, so these are not plain duplicates.
- A few pickups fall on Dec 31 or Feb 1 (22 trips).

**Likely questions**

- *Why does a refund pair matter?* It counts the same ride twice. That gives it double
  weight in training and in the error score.
- *Was it a mistake to call them duplicates?* Yes. The first review called them
  "duplicates", based on checking only 6 columns. Checking all 20 columns showed they are
  refund records. The fix (count each trip once) stayed the same, but the explanation was
  corrected. This is documented in `errors-and-solutions.md`.

---

## Slide 5: Cleaning

**What the slide shows**

- Five rules on the left, each with a one-line reason.
- On the right: **95.3%** of trips kept (3,310,437 of 3,475,226), a kept/removed bar, and
  a yellow note that the first version only kept 1–60 minute trips.

**What to say**

> "Each cleaning rule came from looking at the data. Trips must last 1 to 180 minutes and
> average 1 to 65 miles per hour. Slower than 1 mph is a meter or GPS error; faster than
> 65 is impossible in New York. Distance must be positive and at most 100 miles, and the
> pickup must be in January. Refund pairs count once. That keeps 95 percent of the data.
> The first version cut trips at 60 minutes, and a review showed that this hid about
> 30,000 real long trips, mostly airport runs."

**Details behind it**

| Rule | Evidence |
|---|---|
| Duration 1–180 min | 97.9% of trips are 1–60 min, and 99% are 1–180 min. Trips over 60 min have a median speed of **14.8 mph**, a normal driving speed, so they are real. 1,377 trips over 180 min are dropped. |
| Speed 1–65 mph | **12,657** trips were slower than 1 mph, many below 0.04 mph (for example 0.01 miles in 30 minutes). **252** were faster than 65 mph. |
| Distance > 0 and ≤ 100 mi | Removes zero-distance trips and odometer errors. |
| January only | Removes 22 stray timestamps. |
| Refund pairs once | Removes 52,533 extra rows. |

- **Removed in total:** 164,789 rows (4.7%).
- **v1 vs v2 cleaning:**
  - v1 (1–60 min, no speed check, no refund handling) kept 3,339,084 trips.
  - v2 keeps 3,310,437. It adds about 29,000 long trips and removes about 46,000 extra
    refund rows and about 13,000 trips with impossible speeds.
- The rules live in `src/data.py` as constants (`MIN_DURATION`, `MAX_DURATION`,
  `MIN_SPEED`, `MAX_SPEED`). Each MLflow run logs them, so results always show which rules
  were used.

**Likely questions**

- *Why 180 minutes and not more?* Beyond 3 hours, the records are mostly meters left
  running rather than journeys, and there are very few of them.
- *Doesn't the speed rule remove real gridlock?* Gridlock in Manhattan is still around
  3–5 mph. Under 1 mph means the cab was effectively parked with the meter on.

---

## Slide 6: Features and leakage

**What the slide shows**

- On the left, a green **USED** card listing the six features.
- On the right, a statement that fare, tip, total, tolls and dropoff time are excluded,
  and a bar chart of the **Spearman correlation** with duration. Red bars are columns only
  known after the ride; the green bar is trip distance.
- A caption explaining the fare and the Pearson surprise.

**What to say**

> "The model uses six features, all available when the ride starts: the two zones, the
> distance, the passenger count, and the hour and day of the pickup. The tempting features
> are the money columns. Fare is actually more closely related to duration than distance
> is, because New York meters charge for time spent in traffic. But the fare only exists
> after the ride, so using it would be cheating. That's called leakage. A model trained on
> it would look great in testing and be useless in practice."

**Details behind it**

| Feature | How it's built |
|---|---|
| `PULocationID`, `DOLocationID` | Taxi zone IDs, 1–265. |
| `trip_distance` | Miles. In real use this would come from a route estimate. |
| `passenger_count` | Missing values filled with 1. |
| `pickup_hour`, `pickup_dow` | Taken from the pickup time in **New York local time**. Times sent in UTC are converted first. |

**Correlation with duration:**

| Column | Spearman (rank) | Pearson |
|---|---|---|
| fare_amount | **0.87** | 0.02 |
| trip_distance | 0.85 | 0.80 |
| total_amount | 0.83 | 0.03 |
| tolls_amount | 0.33 | 0.43 |
| tip_amount | 0.29 | 0.46 |

- **Why Pearson said 0.02:** Pearson works with squared distances from the average, so one
  fare of $863,372 plus over 100,000 negative fares dominate it. Spearman ranks the values
  first, so extreme values can't take over. Lesson: on messy data, check a rank-based
  measure before trusting a correlation.
- A test (`test_no_post_trip_leakage_columns`) fails if a post-trip column is ever added
  as a feature.

**Likely questions**

- *Isn't distance also only known after the ride?* The recorded distance is. In a real
  deployment you would use the planned route distance from a maps service, which is known
  before the ride. This is a simplification of the assignment.
- *Why keep passenger count if it barely matters?* It's free to include. The model gives it
  only 0.2% importance (slide 7).

---

## Slide 7: What drives duration

**What the slide shows**

- On the left, **feature importance** bars: trip distance 84.0%, pickup hour 5.6%, dropoff
  zone 4.3%, pickup zone 3.8%, day of week 2.1%, passengers 0.2%.
- On the right, **median speed by pickup hour**: 24 columns, with the fastest hour
  (5am, 15.9 mph) in yellow and the slowest (2pm, 8.5 mph) in red.
- A sentence about MLK Day.

**What to say**

> "Distance explains about 84 percent of the model's decisions: longer trips take longer.
> The rest is traffic. The same trip is almost twice as fast at 5 in the morning as in the
> mid-afternoon. One surprise in the data was that Mondays looked fast. That turned out to
> be Martin Luther King Jr. Day, a holiday with light traffic. The model can't know about
> holidays, so a holiday feature is an obvious next step."

**Details behind it**

- **Feature importance** measures how much each feature reduces error across the forest's
  splits. It shows what the model relies on, not cause and effect.
- **Speed** = distance ÷ duration. Median speed by hour, in mph:
  - overnight: about 12–13;
  - peak at 5am: **15.9**;
  - falls through the morning rush to about 9 by 8am;
  - lowest mid-afternoon: **8.5** at 2pm;
  - recovers in the evening to about 12 by 11pm.
- **The Monday puzzle:**

  | Monday | Median speed |
  |---|---|
  | Jan 6 | 9.82 mph |
  | Jan 13 | 9.76 mph |
  | **Jan 20 (MLK Day)** | **11.57 mph** |
  | Jan 27 | 9.58 mph |
  | *Tuesday–Friday* | *9.19 mph* |

  The holiday explains most of the Monday bump. Ordinary Mondays are still slightly faster
  than Tuesday–Friday.
- Weekends are fastest overall, especially Sunday at 11.2 mph.

**Likely questions**

- *Why does the zone matter if distance already captures so much?* Zones capture *where*
  the trip is. A 2-mile trip in Midtown is much slower than a 2-mile trip in outer
  Queens. Airport zones (132 = JFK, 138 = LaGuardia) have long, fast trips.

---

## Slide 8: Validation

**What the slide shows**

- A January timeline: **Train, Jan 1–24** (dark) and **Validate, Jan 25–31** (yellow).
- A grey bar marking **Jan 18–24**, where Optuna scored its trials.
- Three points: mimics real use, final week untouched, and 792,583 test trips.

**What to say**

> "To test the model honestly, I split by date rather than at random. The model trains on
> the first 24 days and is tested on the last week. That mirrors the real job, which is
> predicting rides that haven't happened yet. A random split would mix trips from the same
> days into both sets, which makes the score look better than it really is. When tuning, I
> picked settings using a slice inside the training period, so the final week was only
> used once, for the final score."

**Details behind it**

| Set | Dates | Trips |
|---|---|---|
| Train | Jan 1–24 | 2,517,854 |
| Validation | Jan 25–31 | 792,583, of which 7,847 are over 60 min |

- **Optuna's inner split:** each trial trained on a 200,000-trip sample from Jan 1–17 and
  was scored on a 200,000-trip sample from Jan 18–24.
- **Why this matters:** if you choose settings by their score on the final week, that week
  is no longer an unseen test. Its score becomes optimistic, because the settings were
  tuned to it. This is a common, subtle mistake.
- The validation week includes a full weekend (Jan 25–26), so it isn't skewed towards
  weekdays.
- A test (`test_split_is_by_time_with_no_overlap`) checks that no training trip happens on
  or after Jan 25.

**Likely questions**

- *Isn't one week a small test?* It's almost 800,000 trips, so the score is very stable.
  The bigger limitation is that it covers only January. Seasonal patterns, such as summer
  or holidays, are untested.

---

## Slide 9: Results

**What the slide shows**

- Four horizontal bars of validation RMSE (lower is better):

  | Model | RMSE |
  |---|---|
  | Always predict the mean | 11.278 |
  | Baseline forest | 4.954 |
  | Optuna-tuned forest | 4.863 |
  | **Baseline settings on all the data (yellow, served)** | **4.786** |

- A card on the right: "Was tuning worth it? **No.**"

**What to say**

> "All three forests cut the error by more than half compared with just guessing the
> average. The stretch task asked whether hyperparameter tuning was worth the extra
> complexity. Optuna found settings that reduced the error by under 2 percent, but the
> model file became almost seven times larger. Simply training the original settings on
> all 2.5 million trips did better, at less than half the size. For this problem, more
> data beat more tuning."

**Details behind it**

| Model | Settings | Training rows | RMSE | File size | Time per prediction |
|---|---|---|---|---|---|
| Mean | — | — | 11.278 | — | — |
| Baseline | 50 trees, depth 20, min leaf 5 | 500,000 sample | 4.954 | 254 MB | 17.3 ms |
| Tuned | 150 trees, depth 26, min leaf 3, `max_features` 0.5 | 500,000 sample | 4.863 | 1,683 MB | 16.6 ms |
| **Served** | Baseline settings | **2,517,854 (all)** | **4.786** | 740 MB | 16.0 ms |

- **Tuning:** 25 Optuna trials (TPE sampler), about 1.5 minutes. The search space covered
  trees (50–200), depth (10–40), min leaf (1–50) and `max_features` (0.33–1.0).
  `max_features = 0.5` appeared in most good trials.
- **Tuned vs baseline:** −1.8% error, 6.6× the file size.
- **Full data vs baseline:** −3.4% error. Training takes about 40 seconds.
- **The same conclusion held twice.** It was true on the v1 data and again after
  retraining on the v2 data.
- Prediction time was measured for one trip with the model already in memory: the median
  of 30 runs. It covers the computation only, not the network round trip.

**Likely questions**

- *Why is the tuned model so large?* Deeper trees (26 vs 20 levels), more of them (150 vs
  50), and smaller leaves (3 vs 5) mean many more nodes to store.
- *Would tuned settings plus all the data be best?* Probably slightly better, but the file
  would be several gigabytes. That's a poor trade for a local service.

---

## Slide 10: v1 vs v2 (honest numbers)

**What the slide shows**

- Grouped columns comparing **v1** (grey, trained on 1–60 min trips) with **v2** (yellow,
  1–180 min, served), all on the **same** 792,583 validation trips:

  | Group | v1 | v2 |
  |---|---|---|
  | All trips | 5.13 | 4.79 |
  | Trips ≤ 60 min | 3.91 | 3.97 |
  | Trips > 60 min | 33.65 | 27.23 |
  | 20–100 mi | 18.11 | 13.43 |

- Two cards: "Better where it matters" (green) and "Known limit" (red).

**What to say**

> "This slide is about honesty. The first version reported an error of 3.96 minutes, but
> only because trips over an hour had been removed from both training and testing. After
> the review, I kept the long trips, and the headline number rose to 4.79. That looks
> worse, but it isn't: on exactly the same trips, the new model is better overall and much
> better on long trips. The cost is a tiny loss on short trips. The remaining weakness is
> that trips over an hour are still predicted about 20 minutes too short. The model simply
> can't see crashes, closures or bad weather."

**Details behind it**

| Measure | v1 | v2 |
|---|---|---|
| RMSE, all trips | 5.131 | **4.786** (−6.7%) |
| RMSE, ≤ 60 min | **3.907** | 3.965 (+1.5%) |
| RMSE, > 60 min | 33.65 | **27.23** |
| Average error, > 60 min | −28.69 min | **−20.56 min** |
| Highest prediction | 57.0 min | 125.1 min |
| Predictions over 60 min | 0 | 2,929 |
| A 100-mile request | 53.5 min (impossible) | 118.7 min |

- **Why the headline rose:** an RMSE depends on which trips are scored. The v1 figure
  (3.958) was scored only on trips under an hour, the easy ones. Comparing 3.958 with
  4.786 directly would compare two different tests.
- **"Average error" (bias)** is the mean of prediction minus actual. Negative means the
  model predicts too short.

**Likely questions**

- *Why not just report the better-looking 3.96?* It describes a model that can't predict
  any trip over 57 minutes, which isn't the real job. Reporting it would be misleading.
- *How would you fix long trips?* With features that explain delays, such as typical
  travel time for each zone pair, holidays and weather, or by predicting the log of
  duration so long trips don't dominate the error.

---

## Slide 11: Tracking with MLflow

**What the slide shows**

- Four icon rows: **Parameters**, **Metrics**, **Artifacts**, and **56 runs**.
- A dark code box with the command that opens the MLflow UI.
- A card describing two gotchas, both fixed.

**What to say**

> "MLflow records every training run: the settings that went in, the scores that came out,
> and the model file itself. That makes any result traceable and comparable. Each run also
> records the cleaning rules, so results from the old and new data can't be mixed up. Two
> practical problems came up with the newest MLflow, and both are fixed in the code so
> they can't come back."

**Details behind it**

- **Parameters logged:** trees, depth, min leaf, `max_features`, random seed, training and
  validation row counts, the feature list, and the cleaning rules (min/max duration,
  min/max speed, max distance, refund handling).
- **Metrics logged:**
  - `rmse_train`, `rmse_val` and `bias_val`;
  - `rmse_val_le60min`, `rmse_val_gt60min` and `bias_val_gt60min`;
  - RMSE by distance range (0–2, 2–5, 5–10, 10–20 and 20–100 miles);
  - `rmse_val_mean_baseline` and `model_size_mb`.
- **Artifacts:** `model.skops` and `feature_importances.json`. **skops** is a safer
  alternative to pickle: it refuses to load object types it doesn't recognise, and the
  loader trusts only the one sklearn type a forest needs.
- **56 runs:** 6 top-level runs (baseline, tuned and full data, for both v1 and v2) plus
  2 × 25 Optuna trials stored as nested child runs.
- **Gotcha 1:** MLflow 3.17 refuses the plain `./mlruns` folder as a tracking store. It
  raised an error telling users to switch to a database, so tracking moved to SQLite
  (`mlflow.db`).
- **Gotcha 2:** MLflow 3's new interface opened experiments on a GenAI "Traces" view, so
  the training runs seemed missing. The fix tags the experiment as
  `mlflow.experimentKind = custom_model_development` every time training starts.
- The direct link to the runs table is `http://127.0.0.1:5000/#/experiments/1/runs`.

**Likely questions**

- *Why does logging the cleaning rules matter?* The v1 and v2 runs have similar names. The
  logged rules are how the notebook labels each run correctly and avoids comparing scores
  from different test sets.

---

## Slide 12: Serving with FastAPI

**What the slide shows**

- Three endpoints: `GET /health`, `POST /predict` and `GET /docs`.
- Three safeguards:
  - bad input returns 422;
  - UTC times are converted to New York time;
  - about 16 ms per prediction.
- A dark code box with a `curl` request, the JSON body, and the response
  `{"duration_minutes": 17.24}`.

**What to say**

> "The model is served by a small FastAPI app. You send a trip as JSON and get back the
> predicted minutes. Bad input, like a zone that doesn't exist or a date with no time, is
> rejected with a clear error before it reaches the model. Times sent in UTC are converted
> to New York time, because the model learned from local times. The model loads once at
> startup, so each prediction takes about 16 milliseconds."

**Details behind it**

| Field | Rule |
|---|---|
| `PULocationID`, `DOLocationID` | Integer, 1–265 |
| `trip_distance` | More than 0, at most 100 |
| `passenger_count` | Optional, 0–9 |
| `tpep_pickup_datetime` | Must include a time. Without a time zone it is read as New York time; with one (for example `Z` for UTC) it is converted. |

- **Invalid input returns HTTP 422,** with a message naming the field. Examples:
  - zone 999;
  - a negative distance;
  - `"2025-01-27"`, which would otherwise have been silently treated as midnight.
- **The time-zone fix:** before the review, `08:30Z` (3:30am in New York) was predicted as
  if it were 8:30am. Now `08:30Z`, `03:30-05:00`, `03:30` and the Unix timestamp
  `1737966600` all give the same answer (12.85 min with the current model).
- **Model version:** each response includes a `model_version` such as
  `rf-20261119154228`, so you can tell which model answered. After retraining, restart the
  API to load the new file.
- **Other example predictions:**
  - JFK → Times Square, 17.5 mi at 5:30pm: **52.36 min**;
  - a 100-mile trip: **118.69 min**.
- **Common confusions:**
  - Opening `http://127.0.0.1:8000/` gives **404**, because there is no page at the root.
    Use `/docs`.
  - Opening `/predict` in a browser gives **405**, because it only accepts POST.

**Likely questions**

- *Is 16 ms the full response time?* It's the model's computation time. A full HTTP request
  adds a little more on top. It's still fast for a local service.

---

## Slide 13: Quality

**What the slide shows**

- A big **37**: automated tests, all passing in about 1.5 seconds.
- Six pills naming what the tests cover.
- Four cards highlighting review findings: the problem, what went wrong, and the fix
  (in green).

**What to say**

> "Passing tests aren't the same as correct software. After the first version passed all
> 22 of its tests, I reviewed it by trying edge cases, and found nine issues. For example,
> UTC times were misread, the code crashed when run from another folder, and the default
> training command could quietly replace the best model with a weaker one. The biggest
> was the 60-minute cutoff from slide 10. Every fix came with a new test, bringing the
> total to 37."

**Details behind it**

**The 37 tests:**

| Test file | Tests | Covers |
|---|---|---|
| `test_data.py` | 8 | Duration calculation, each cleaning rule, long trips kept, impossible speeds dropped, refund pairs, time split, safe download (interrupted and successful) |
| `test_features.py` | 6 | Columns and order, missing passengers, hour and day, no leakage, time-zone conversion (including summer time and a day change) |
| `test_evaluate.py` | 1 | Error by segment and distance range |
| `test_model.py` | 5 | Load and predict, learns the signal, clear error when the model is missing, model-path override, real-model sanity check |
| `test_api.py` | 13 | Health, sample prediction, optional passengers, 6 invalid inputs, missing field, UTC equivalence, 2 date-only cases |
| `test_paths_and_training.py` | 4 | Paths anchored to the project, safe training default, MLflow label |

- The tests use a tiny 5-tree model trained on 200 synthetic trips, so they need neither
  the 56 MB dataset nor the 740 MB model.

**All nine review findings:**

1. UTC times read as local time.
2. Crashes when run outside the project folder.
3. The default training command overwrote the best model.
4. The 60-minute cutoff hid long trips.
5. Refund pairs counted twice.
6. A date with no time was accepted as midnight.
7. The MLflow label had only been set by hand.
8. An interrupted download left a corrupt file.
9. The notebook's generator script was missing from the repo.

**Checking the tests themselves:** the time-zone and date-only fixes were temporarily
undone, and 4 tests failed, which proves they really detect those bugs.

**Likely questions**

- *How did you find bugs the tests missed?* By trying inputs a real user might send: UTC
  timestamps, running from another folder, a 100-mile trip. Then by measuring error by
  segment instead of only the overall average.

---

## Slide 14: The two questions

**What the slide shows**

- On the left: **1 · Final model RMSE**, **4.786** minutes, with context.
- On the right: **2 · With more time**, as four icon rows: better features, gradient
  boosting, a better target, and a production path.

**What to say**

> "The assignment asks two questions. First, the final model's error: 4.786 minutes on the
> held-out last week of January, or 3.97 for trips up to an hour, compared with 11.28 for
> always guessing the average. Second, what I'd do with more time. The biggest gain would
> come from features that explain long, slow trips. After that, I'd try gradient boosting,
> which is usually more accurate and produces much smaller models, change the target so
> long trips don't dominate, and package the service for production."

**Details behind it**

- **1. Final RMSE: 4.786 min** on Jan 25–31 (792,583 trips of 1–180 min). The model is
  the baseline Random Forest settings (50 trees, depth 20, min leaf 5) trained on all
  2,517,854 training trips.
- **2. With more time:**

  | Idea | Why |
  |---|---|
  | Better features | Typical travel time for each pickup→dropoff zone pair, holiday flag (MLK Day showed the effect), weather, incident data. These target the 20-minute underestimate on long trips. |
  | Gradient boosting | `HistGradientBoostingRegressor` or LightGBM are usually more accurate on tables, train faster, and produce files in megabytes instead of 740 MB. |
  | Better target | Predict `log(duration)` so long trips don't dominate. Report MAE (average absolute error) alongside RMSE. |
  | Production path | Docker packaging, loading the model from the MLflow Model Registry instead of a file path, and data checks (Great Expectations) before retraining on a new month. |

**Likely questions**

- *Which would you do first?* The zone-pair history feature. It is cheap to compute from
  the training data and directly targets the largest remaining error.

---

## Slide 15: Run it yourself

**What the slide shows**

- Six labelled commands on a dark background, with checkerboard strips.
- A link to the GitHub repository.

**What to say**

> "Everything runs on one machine with six commands: install, test, train, open MLflow,
> start the API, and try it in the browser. The repository also has the exploration
> notebook, a step-by-step process log, and a log of every error I hit and how I fixed
> it. Thank you, and I'm happy to take questions."

**Details behind it**

| Step | Command | What to expect |
|---|---|---|
| Install | `uv sync` | Creates `.venv/` with the locked dependencies. |
| Test | `uv run pytest -q` | `37 passed`. |
| Train | `uv run python -m src.train` | Downloads the data if needed, trains on all rows (about 40 s), prints `val=4.786`, and saves `artifacts/model.skops`. |
| Track | `uv run mlflow ui --backend-store-uri sqlite:///mlflow.db` | Open `http://127.0.0.1:5000/#/experiments/1/runs`. |
| Serve | `uv run uvicorn app.main:app --port 8000` | Wait for "Uvicorn running". |
| Try | Open `http://127.0.0.1:8000/docs` | Try `POST /predict` with the sample request: 17.24 min. |

- **Supporting documents in the repo:**
  - `README.md`: results and answers;
  - `project-processed.md`: every step, with commands and decisions;
  - `errors-and-solutions.md`: 20 problems with causes and fixes;
  - `notebooks/01_eda.ipynb`: the exploration and model comparison.

**Likely questions**

- *Can I see it live?* Start the API with the Serve command and open `/docs`. This makes a
  good live demo to end on.
