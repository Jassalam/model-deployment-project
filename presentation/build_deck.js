const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

const OUT = process.argv[2] || "nyc-taxi-trip-duration.pptx";

// Palette: NYC taxi — charcoal dominates, cream for content, taxi yellow as the accent.
const INK = "17181C", PAPER = "F6F4EF", CARD = "FFFFFF", TAXI = "F7B500";
const SLATE = "3D424B", MUTED = "7A808A", LINE = "E3DFD5", GOOD = "2E7D5B", BAD = "B23A2E";
const H = "Arial Black", B = "Arial", MONO = "Courier New";

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.title = "Predicting NYC Taxi Trip Duration";
  const R = pres.shapes.RECTANGLE, O = pres.shapes.OVAL;
  let page = 0;

  // Icon in a yellow circle: the repeated motif.
  async function badge(s, Comp, x, y, d = 0.5, bg = TAXI, fg = INK) {
    s.addShape(O, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg } });
    const pad = d * 0.24;
    s.addImage({ data: await icon(Comp, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
  }

  function checker(s, y, rows = 2, sq = 0.16) {
    const n = Math.ceil(10 / sq);
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < n; i++)
        if ((i + r) % 2 === 0)
          s.addShape(R, { x: i * sq, y: y + r * sq, w: sq, h: sq, fill: { color: TAXI }, line: { color: TAXI } });
  }

  function content(kicker, title) {
    const s = pres.addSlide();
    page += 1;
    s.background = { color: PAPER };
    s.addShape(R, { x: 0.5, y: 0.42, w: 0.15, h: 0.15, fill: { color: TAXI }, line: { color: TAXI } });
    s.addText(kicker, { x: 0.75, y: 0.33, w: 7, h: 0.33, fontFace: B, fontSize: 10, bold: true, color: MUTED, charSpacing: 3, margin: 0, valign: "middle" });
    s.addText(title, { x: 0.5, y: 0.68, w: 9, h: 0.62, fontFace: H, fontSize: 26, color: INK, margin: 0, valign: "middle" });
    s.addText("NYC Taxi Trip Duration", { x: 0.5, y: 5.2, w: 4, h: 0.25, fontFace: B, fontSize: 9, color: MUTED, margin: 0 });
    s.addText(String(page), { x: 8.5, y: 5.2, w: 1, h: 0.25, fontFace: B, fontSize: 9, color: MUTED, margin: 0, align: "right" });
    return s;
  }

  function card(s, x, y, w, h, accent = TAXI) {
    s.addShape(R, { x, y, w, h, fill: { color: CARD }, line: { color: LINE, width: 0.75 } });
    s.addShape(R, { x, y, w: 0.07, h, fill: { color: accent }, line: { color: accent } });
  }

  // Horizontal bars drawn with shapes (native charts are dropped by Keynote/PDF export).
  function hbars(s, items, o) {
    const { x, y, labelW, barMax, rowH, maxVal, color, fmt, labelFace = B, labelSize = 10.5, barH = rowH * 0.62 } = o;
    items.forEach(([label, v, c], i) => {
      const yy = y + i * rowH;
      s.addText(label, { x, y: yy, w: labelW - 0.1, h: rowH, fontFace: labelFace, fontSize: labelSize, color: INK, margin: 0, valign: "middle" });
      const w = Math.max(0.03, (v / maxVal) * barMax);
      s.addShape(R, { x: x + labelW, y: yy + (rowH - barH) / 2, w, h: barH, fill: { color: c || color }, line: { color: c || color } });
      s.addText(fmt(v), { x: x + labelW + w + 0.07, y: yy, w: 0.8, h: rowH, fontFace: B, fontSize: 10.5, bold: true, color: INK, margin: 0, valign: "middle" });
    });
  }

  function codeBox(s, x, y, w, h, lines, size = 10) {
    s.addShape(R, { x, y, w, h, fill: { color: INK }, line: { color: INK } });
    s.addText(lines.map((t, i) => ({
      text: t.text, options: { color: t.color || "E8E6E1", bold: !!t.bold, breakLine: i < lines.length - 1 },
    })), { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: h - 0.24, fontFace: MONO, fontSize: size, valign: "top", margin: 0, paraSpaceAfter: 2 });
  }

  // ---------- 1. Title ----------
  {
    const s = pres.addSlide(); page += 1;
    s.background = { color: INK };
    checker(s, 0);
    s.addText("MODEL DEPLOYMENT PROJECT  ·  JANUARY 2025", { x: 0.6, y: 1.05, w: 5.7, h: 0.3, fontFace: B, fontSize: 10, bold: true, color: TAXI, charSpacing: 3, margin: 0 });
    s.addText("Predicting NYC Taxi Trip Duration", { x: 0.6, y: 1.45, w: 5.7, h: 1.7, fontFace: H, fontSize: 36, color: "FFFFFF", margin: 0, valign: "top" });
    s.addText("Train, track and serve a Random Forest with scikit-learn, MLflow and FastAPI, then review it and fix what the tests missed.",
      { x: 0.6, y: 3.25, w: 5.5, h: 0.9, fontFace: B, fontSize: 14, color: "C9C7C2", margin: 0, valign: "top" });
    s.addShape(R, { x: 6.75, y: 1.45, w: 2.65, h: 2.7, fill: { color: "22242A" }, line: { color: TAXI, width: 1.5 } });
    s.addText("4.79", { x: 6.75, y: 1.65, w: 2.65, h: 1.0, fontFace: H, fontSize: 54, color: TAXI, align: "center", margin: 0 });
    s.addText("minutes RMSE on the\nheld-out final week", { x: 6.85, y: 2.65, w: 2.45, h: 0.6, fontFace: B, fontSize: 12, color: "FFFFFF", align: "center", margin: 0 });
    s.addText("3.31M trips  ·  37 tests\n3 merged pull requests", { x: 6.85, y: 3.4, w: 2.45, h: 0.55, fontFace: B, fontSize: 10, color: "C9C7C2", align: "center", margin: 0 });
    checker(s, 5.625 - 0.32);
    s.addNotes("This project predicts how long a New York yellow-taxi ride will take, using only information known when the ride starts. I trained a Random Forest on January 2025 trips, tracked every experiment in MLflow, and served the model through a FastAPI endpoint. The final model is off by about 4.8 minutes (RMSE) on the last week of January, which it never saw during training.");
  }

  // ---------- 2. Goal ----------
  {
    const s = content("THE GOAL", "Estimate trip time before it starts");
    s.addText([
      { text: "Input", options: { bold: true, color: INK, breakLine: true } },
      { text: "Pickup and dropoff zone, trip distance, pickup time, passengers.", options: { breakLine: true } },
      { text: " ", options: { fontSize: 6, breakLine: true } },
      { text: "Output", options: { bold: true, color: INK, breakLine: true } },
      { text: "Predicted duration in minutes, returned by an HTTP API.", options: { breakLine: true } },
      { text: " ", options: { fontSize: 6, breakLine: true } },
      { text: "Why only these fields?", options: { bold: true, color: INK, breakLine: true } },
      { text: "The prediction is made at pickup, so anything known only after the ride (fare, tip, dropoff time) is off-limits." },
    ], { x: 0.5, y: 1.55, w: 4.1, h: 3.25, fontFace: B, fontSize: 13, color: SLATE, valign: "middle", margin: 0 });

    const tools = [
      [fa.FaTree, "scikit-learn", "RandomForestRegressor"],
      [fa.FaFlask, "MLflow", "Experiment tracking"],
      [fa.FaBolt, "FastAPI", "Serves /predict locally"],
      [fa.FaVial, "pytest + Optuna", "Tests and tuning"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 5.0 + (i % 2) * 2.3, y = 1.55 + Math.floor(i / 2) * 1.75;
      card(s, x, y, 2.1, 1.5);
      await badge(s, tools[i][0], x + 0.25, y + 0.2, 0.5);
      s.addText(tools[i][1], { x: x + 0.25, y: y + 0.78, w: 1.75, h: 0.32, fontFace: B, fontSize: 13, bold: true, color: INK, margin: 0 });
      s.addText(tools[i][2], { x: x + 0.25, y: y + 1.08, w: 1.75, h: 0.3, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0 });
    }
    s.addNotes("The assignment: train and locally deploy a model that predicts trip duration. The key design constraint is that a prediction is requested when the trip starts, so the model may only use fields known at that moment. The required stack is scikit-learn, MLflow and FastAPI; tests and Optuna tuning were stretch goals, and both were done.");
  }

  // ---------- 3. Pipeline ----------
  {
    const s = content("THE PIPELINE", "From raw trips to a live API");
    const steps = [
      [fa.FaCloudDownloadAlt, "Download", "Jan 2025 parquet, 3.48M trips", "src/data.py"],
      [fa.FaFilter, "Clean", "Drop broken records, define duration", "src/data.py"],
      [fa.FaSlidersH, "Features", "6 fields known at pickup", "src/features.py"],
      [fa.FaTree, "Train", "Random Forest, time-based split", "src/train.py"],
      [fa.FaFlask, "Track", "Params, metrics, model in MLflow", "mlflow.db"],
      [fa.FaBolt, "Serve", "FastAPI /predict endpoint", "app/main.py"],
    ];
    const w = 1.3, gap = 0.22, y = 1.65;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.55 + i * (w + gap);
      s.addShape(R, { x, y, w, h: 2.25, fill: { color: CARD }, line: { color: LINE, width: 0.75 } });
      s.addText(String(i + 1), { x: x + 0.1, y: y + 0.08, w: 0.4, h: 0.3, fontFace: H, fontSize: 12, color: MUTED, margin: 0 });
      await badge(s, steps[i][0], x + (w - 0.55) / 2, y + 0.35, 0.55);
      s.addText(steps[i][1], { x, y: y + 1.0, w, h: 0.32, fontFace: B, fontSize: 13, bold: true, color: INK, align: "center", margin: 0 });
      s.addText(steps[i][2], { x: x + 0.08, y: y + 1.34, w: w - 0.16, h: 0.7, fontFace: B, fontSize: 10, color: SLATE, align: "center", valign: "top", margin: 0 });
      s.addText(steps[i][3], { x: x + 0.05, y: y + 1.85, w: w - 0.1, h: 0.3, fontFace: MONO, fontSize: 9, bold: true, color: SLATE, align: "center", margin: 0 });
      if (i < steps.length - 1)
        s.addShape(R, { x: x + w + 0.04, y: y + 0.6, w: gap - 0.08, h: 0.05, fill: { color: TAXI }, line: { color: TAXI } });
    }
    s.addText([
      { text: "One feature function, two callers: ", options: { bold: true, color: INK } },
      { text: "training and the API both call prepare_features(), so serving can never prepare inputs differently from training." },
    ], { x: 0.55, y: 4.2, w: 8.9, h: 0.6, fontFace: B, fontSize: 12.5, color: SLATE, margin: 0, valign: "middle" });
    s.addNotes("Six stages, each in its own module. The important design choice is that feature preparation lives in one function used by both training and the API, which rules out training/serving skew.");
  }

  // ---------- 4. The data ----------
  {
    const s = content("THE DATA", "3.48M trips, and plenty of mess");
    const stats = [
      ["3,475,226", "raw trips in January 2025", INK],
      ["−51,472", "minutes: the 'shortest' trip (clock errors)", BAD],
      ["15.5%", "of rows missing passenger count", INK],
      ["52,533", "refund pairs: one trip recorded twice", BAD],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.5 + i * 2.3;
      card(s, x, 1.65, 2.1, 1.4, stats[i][2] === BAD ? BAD : TAXI);
      s.addText(stats[i][0], { x: x + 0.22, y: 1.78, w: 1.8, h: 0.55, fontFace: H, fontSize: 22, color: stats[i][2], margin: 0, valign: "middle" });
      s.addText(stats[i][1], { x: x + 0.22, y: 2.36, w: 1.75, h: 0.6, fontFace: B, fontSize: 11, color: SLATE, margin: 0, valign: "top" });
    }
    await badge(s, fa.FaSearch, 0.5, 3.5, 0.5);
    s.addText([
      { text: "Other surprises: ", options: { bold: true, color: INK } },
      { text: "trips lasting up to 5,626 min (about 4 days, meters left running), distances up to 276,424 miles, and fares from −$900 to $863,372. Refund pairs share the same time, zones and distance but carry a negated fare (+7.90 / −7.90)." },
    ], { x: 1.2, y: 3.42, w: 8.3, h: 1.5, fontFace: B, fontSize: 13, color: SLATE, margin: 0, valign: "top" });
    s.addNotes("Real-world data is messy. Durations ranged from minus 51 thousand minutes to four days. Fifteen percent of rows had no passenger count. And 52,533 trips appear twice: once normally and once as a refund with the fare negated. Every one of these needed a rule before training.");
  }

  // ---------- 5. Cleaning ----------
  {
    const s = content("CLEANING", "Rules chosen from the data");
    const rules = [
      ["Duration 1–180 min", "Removes clock errors and meters left running; keeps real airport runs"],
      ["Speed 1–65 mph", "Under 1 mph = meter/GPS error (12,657 trips); over 65 mph is impossible in NYC"],
      ["Distance > 0 and ≤ 100 mi", "Removes zero-distance and absurd odometer values"],
      ["Pickup in January 2025", "Drops stray Dec/Feb timestamps"],
      ["Refund pairs counted once", "Same trip, negated fare: keep one row"],
    ];
    rules.forEach(([r, why], i) => {
      const y = 1.55 + i * 0.68;
      s.addShape(R, { x: 0.5, y: y + 0.08, w: 0.13, h: 0.42, fill: { color: TAXI }, line: { color: TAXI } });
      s.addText(r, { x: 0.8, y, w: 5.2, h: 0.3, fontFace: B, fontSize: 13, bold: true, color: INK, margin: 0 });
      s.addText(why, { x: 0.8, y: y + 0.29, w: 5.2, h: 0.3, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0 });
    });
    s.addText("95.3%", { x: 6.45, y: 1.5, w: 3.05, h: 0.8, fontFace: H, fontSize: 40, color: INK, margin: 0 });
    s.addText("of raw trips kept: 3,310,437 of 3,475,226", { x: 6.45, y: 2.28, w: 3.05, h: 0.3, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0 });
    const kw = 3.05 * 0.953;
    s.addShape(R, { x: 6.45, y: 2.7, w: kw, h: 0.4, fill: { color: TAXI }, line: { color: TAXI } });
    s.addShape(R, { x: 6.45 + kw, y: 2.7, w: 3.05 - kw, h: 0.4, fill: { color: BAD }, line: { color: BAD } });
    s.addText("kept", { x: 6.45, y: 3.14, w: 1.5, h: 0.25, fontFace: B, fontSize: 9.5, bold: true, color: SLATE, margin: 0 });
    s.addText("removed: 164,789", { x: 7.8, y: 3.14, w: 1.7, h: 0.25, fontFace: B, fontSize: 9.5, bold: true, color: BAD, align: "right", margin: 0 });
    s.addShape(R, { x: 6.45, y: 3.75, w: 3.05, h: 1.1, fill: { color: "FBEFD0" }, line: { color: TAXI, width: 0.75 } });
    s.addText([
      { text: "v1 kept only 1–60 min ", options: { bold: true } },
      { text: "and silently dropped ~30,000 real long trips. Fixed after review." },
    ], { x: 6.6, y: 3.75, w: 2.8, h: 1.1, fontFace: B, fontSize: 11, color: INK, margin: 0, valign: "middle" });
    s.addNotes("Each rule came from looking at the data. Trips over an hour have a median speed of 14.8 mph, so most are genuine, which is why the final rules keep trips up to 180 minutes and use a speed check to remove broken records instead. The first version cut at 60 minutes; a review showed that this hid about 30,000 real long trips.");
  }

  // ---------- 6. Features & leakage ----------
  {
    const s = content("FEATURES & LEAKAGE", "Only what's known at pickup");
    card(s, 0.5, 1.55, 4.2, 3.45, GOOD);
    s.addText("USED", { x: 0.75, y: 1.68, w: 3, h: 0.3, fontFace: B, fontSize: 11, bold: true, color: GOOD, charSpacing: 2, margin: 0 });
    const used = ["Pickup zone (PULocationID)", "Dropoff zone (DOLocationID)", "Trip distance", "Passenger count (missing → 1)", "Pickup hour (New York time)", "Pickup day of week"];
    for (let i = 0; i < used.length; i++) {
      s.addImage({ data: await icon(fa.FaCheck, GOOD), x: 0.78, y: 2.1 + i * 0.45, w: 0.2, h: 0.2 });
      s.addText(used[i], { x: 1.1, y: 2.03 + i * 0.45, w: 3.4, h: 0.34, fontFace: B, fontSize: 12, color: INK, margin: 0, valign: "middle" });
    }
    s.addText("Fare, tip, total, tolls and dropoff time are excluded: they only exist after the ride.",
      { x: 5.0, y: 1.55, w: 4.5, h: 0.55, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0, valign: "top" });
    s.addText([{ text: "Spearman correlation  ·  ", options: { color: MUTED } }, { text: "red", options: { color: BAD } }, { text: " = known only after the ride", options: { color: MUTED } }], { x: 5.0, y: 2.12, w: 4.5, h: 0.28, fontFace: B, fontSize: 10, bold: true, margin: 0 });
    hbars(s, [["fare_amount", 0.87, BAD], ["trip_distance", 0.85, GOOD], ["total_amount", 0.83, BAD], ["tolls_amount", 0.33, BAD], ["tip_amount", 0.29, BAD]],
      { x: 5.0, y: 2.45, labelW: 1.45, barMax: 2.35, rowH: 0.36, maxVal: 1, color: BAD, fmt: (v) => v.toFixed(2), labelFace: MONO, labelSize: 10 });
    s.addText("Fare tracks duration more closely than distance does, so using it would leak the answer. (Pearson said 0.02, fooled by one $863,372 fare.)",
      { x: 5.0, y: 4.35, w: 4.5, h: 0.65, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top" });
    s.addNotes("Six features, all known at pickup. The tempting features are the money columns: fare correlates with duration even more strongly than distance does, because meters charge for time. That is exactly why it would leak. A side lesson: ordinary Pearson correlation reported 0.02 for fare because one fare of 863 thousand dollars swamped it; a rank-based correlation shows the real relationship.");
  }

  // ---------- 7. Drivers ----------
  {
    const s = content("WHAT DRIVES DURATION", "Distance first, then traffic");
    s.addText("Feature importance (final model)", { x: 0.5, y: 1.5, w: 4.3, h: 0.3, fontFace: B, fontSize: 11.5, bold: true, color: INK, margin: 0 });
    hbars(s, [["Trip distance", 84.0, TAXI], ["Pickup hour", 5.6], ["Dropoff zone", 4.3], ["Pickup zone", 3.8], ["Day of week", 2.1], ["Passengers", 0.2]],
      { x: 0.5, y: 1.9, labelW: 1.35, barMax: 2.55, rowH: 0.42, maxVal: 84, color: "9A9790", fmt: (v) => v.toFixed(1) + "%" });
    s.addText("Median speed by pickup hour (mph)", { x: 5.2, y: 1.5, w: 4.3, h: 0.3, fontFace: B, fontSize: 11.5, bold: true, color: INK, margin: 0 });
    const hours = [12.25, 12.3, 12.66, 13.49, 15.19, 15.94, 13.66, 11.01, 9.29, 9.11, 9.0, 8.64, 8.63, 8.6, 8.53, 8.54, 8.81, 8.67, 8.97, 9.66, 10.46, 10.78, 11.08, 11.88];
    const base = 4.25, top = 2.0, slot = 4.3 / 24;
    hours.forEach((v, i) => {
      const h = (v / 16) * (base - top);
      const c = i === 5 ? TAXI : (i === 14 ? BAD : INK);
      s.addShape(R, { x: 5.2 + i * slot + 0.02, y: base - h, w: slot - 0.04, h, fill: { color: c }, line: { color: c } });
      if (i % 3 === 0) s.addText(String(i), { x: 5.2 + i * slot - 0.1, y: base + 0.03, w: slot + 0.2, h: 0.2, fontFace: B, fontSize: 8, color: MUTED, align: "center", margin: 0 });
    });
    s.addText("15.9", { x: 5.2 + 5 * slot - 0.2, y: base - (15.94 / 16) * (base - top) - 0.24, w: slot + 0.4, h: 0.22, fontFace: B, fontSize: 9, bold: true, color: INK, align: "center", margin: 0 });
    s.addText("8.5", { x: 5.2 + 14 * slot - 0.2, y: base - (8.53 / 16) * (base - top) - 0.24, w: slot + 0.4, h: 0.22, fontFace: B, fontSize: 9, bold: true, color: BAD, align: "center", margin: 0 });
    s.addText("hour of day", { x: 8.5, y: base + 0.22, w: 1.0, h: 0.2, fontFace: B, fontSize: 8, color: MUTED, align: "right", margin: 0 });
    s.addText([
      { text: "16 mph at 5am, 8.5 mph mid-afternoon. ", options: { bold: true, color: INK } },
      { text: "MLK Day (Mon, Jan 20) ran at 11.6 mph vs about 9.7 on other Mondays: a holiday flag is a clear next feature." },
    ], { x: 0.5, y: 4.58, w: 9, h: 0.5, fontFace: B, fontSize: 11.5, color: SLATE, margin: 0, valign: "middle" });
    s.addNotes("Distance explains about 84 percent of the model's decisions. The rest is traffic: the same distance takes much longer mid-afternoon than at 5am. One unexpected finding was that Mondays looked fast; that turned out to be Martin Luther King Jr. Day, which suggests adding a holiday feature.");
  }

  // ---------- 8. Split ----------
  {
    const s = content("VALIDATION", "Test on the future, not at random");
    const x0 = 0.5, W = 9.0, d2x = (d) => x0 + ((d - 1) / 31) * W; // day of month -> x
    s.addText("January 2025", { x: x0, y: 1.6, w: 3, h: 0.3, fontFace: B, fontSize: 11, bold: true, color: MUTED, margin: 0 });
    s.addShape(R, { x: d2x(1), y: 2.0, w: d2x(25) - d2x(1), h: 0.62, fill: { color: INK }, line: { color: INK } });
    s.addShape(R, { x: d2x(25), y: 2.0, w: d2x(32) - d2x(25), h: 0.62, fill: { color: TAXI }, line: { color: TAXI } });
    s.addText("TRAIN  ·  Jan 1–24  ·  2,517,854 trips", { x: d2x(1) + 0.15, y: 2.0, w: 5.5, h: 0.62, fontFace: B, fontSize: 12, bold: true, color: "FFFFFF", margin: 0, valign: "middle" });
    s.addText("VALIDATE  ·  Jan 25–31", { x: d2x(25), y: 2.0, w: d2x(32) - d2x(25), h: 0.62, fontFace: B, fontSize: 11, bold: true, color: INK, align: "center", margin: 0, valign: "middle" });
    s.addShape(R, { x: d2x(18), y: 2.72, w: d2x(25) - d2x(18), h: 0.32, fill: { color: "5C6370" }, line: { color: "5C6370" } });
    s.addText("Optuna scored here", { x: d2x(18), y: 2.72, w: d2x(25) - d2x(18), h: 0.32, fontFace: B, fontSize: 9, bold: true, color: "FFFFFF", align: "center", margin: 0, valign: "middle" });
    ["1", "8", "15", "18", "25", "31"].forEach((d) => s.addText(d, { x: d2x(+d) - 0.2, y: 3.08, w: 0.4, h: 0.22, fontFace: B, fontSize: 9, color: MUTED, align: "center", margin: 0 }));

    const pts = [
      [fa.FaClock, "Mimics real use", "The model always predicts trips that happen after the data it learned from."],
      [fa.FaLock, "Final week untouched", "Tuning picked settings on Jan 18–24, so Jan 25–31 stays a fair final test."],
      [fa.FaRoad, "792,583 test trips", "Including 7,847 longer than an hour and a full weekend."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.5 + i * 3.05;
      await badge(s, pts[i][0], x, 3.7, 0.5);
      s.addText(pts[i][1], { x: x + 0.63, y: 3.68, w: 2.3, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
      s.addText(pts[i][2], { x: x + 0.63, y: 4.0, w: 2.3, h: 1.0, fontFace: B, fontSize: 11, color: SLATE, margin: 0, valign: "top" });
    }
    s.addNotes("A random split would mix trips from the same days into both sets and flatter the score. Splitting by date simulates the real job: predicting the future. Hyperparameter tuning used a slice inside the training period, so the final week was only ever used once, for the final scores.");
  }

  // ---------- 9. Results ----------
  {
    const s = content("RESULTS", "More data beat tuning");
    const rows = [
      ["Always predict the mean", "no model", 11.278, "D9D5CB"],
      ["Baseline forest", "500k rows · 254 MB", 4.954, "9A9790"],
      ["Optuna-tuned forest", "500k rows · 1,683 MB", 4.863, "9A9790"],
      ["Baseline settings, all data", "2.52M rows · 740 MB · served", 4.786, TAXI],
    ];
    s.addText("Validation RMSE, minutes (lower is better)", { x: 0.5, y: 1.5, w: 6, h: 0.3, fontFace: B, fontSize: 11, bold: true, color: MUTED, margin: 0 });
    const bx = 2.75, bmax = 3.0;
    rows.forEach(([name, sub, v, c], i) => {
      const y = 1.95 + i * 0.75;
      s.addText(name, { x: 0.5, y, w: 2.2, h: 0.3, fontFace: B, fontSize: 11.5, bold: true, color: INK, margin: 0 });
      s.addText(sub, { x: 0.5, y: y + 0.28, w: 2.2, h: 0.28, fontFace: B, fontSize: 9, color: MUTED, margin: 0 });
      const w = (v / 11.278) * bmax;
      s.addShape(R, { x: bx, y: y + 0.04, w, h: 0.48, fill: { color: c }, line: { color: c } });
      s.addText(v.toFixed(3), { x: bx + w + 0.08, y: y + 0.04, w: 0.8, h: 0.48, fontFace: H, fontSize: 13, color: INK, margin: 0, valign: "middle" });
    });
    card(s, 6.85, 1.95, 2.65, 2.4);
    s.addText("Was tuning worth it?", { x: 7.08, y: 2.07, w: 2.3, h: 0.35, fontFace: B, fontSize: 13, bold: true, color: INK, margin: 0 });
    s.addText("No.", { x: 7.08, y: 2.4, w: 2.3, h: 0.55, fontFace: H, fontSize: 26, color: BAD, margin: 0 });
    s.addText([
      { text: "25 Optuna trials cut error by only 1.8%, for a model file 6.6× larger.", options: { breakLine: true } },
      { text: " ", options: { fontSize: 6, breakLine: true } },
      { text: "Training the plain baseline on all 2.52M trips did better (−3.4%), at less than half the tuned size." },
    ], { x: 7.08, y: 2.98, w: 2.3, h: 1.7, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top" });
    s.addNotes("All three forests beat the naive baseline by more than half. The stretch task asked whether tuning was worth it: Optuna found settings that improved error by under 2 percent but produced a model almost seven times larger. Simply using all the data did better. All models answer a single request in about 16 milliseconds.");
  }

  // ---------- 10. v1 vs v2 ----------
  {
    const s = content("HONEST NUMBERS", "Keeping long trips: v1 vs v2");
    s.addText("RMSE on the same 792,583 validation trips (minutes)", { x: 0.5, y: 1.48, w: 6, h: 0.3, fontFace: B, fontSize: 11, bold: true, color: MUTED, margin: 0 });
    const groups = [["All trips", 5.13, 4.79], ["Trips ≤ 60 min", 3.91, 3.97], ["Trips > 60 min", 33.65, 27.23], ["20–100 mi", 18.11, 13.43]];
    const gx = 0.5, gw = 1.5, bw = 0.5, cbase = 4.6, chmax = 2.1;
    s.addShape(R, { x: 0.5, y: 1.92, w: 0.16, h: 0.16, fill: { color: "9A9790" }, line: { color: "9A9790" } });
    s.addText("v1: trained on 1–60 min", { x: 0.72, y: 1.85, w: 2.2, h: 0.3, fontFace: B, fontSize: 10, color: SLATE, margin: 0, valign: "middle" });
    s.addShape(R, { x: 3.0, y: 1.92, w: 0.16, h: 0.16, fill: { color: TAXI }, line: { color: TAXI } });
    s.addText("v2: 1–180 min (served)", { x: 3.22, y: 1.85, w: 2.2, h: 0.3, fontFace: B, fontSize: 10, bold: true, color: INK, margin: 0, valign: "middle" });
    groups.forEach(([label, v1, v2], i) => {
      const x = gx + i * gw + 0.2;
      [[v1, "9A9790", 0], [v2, TAXI, 1]].forEach(([v, c, k]) => {
        const h = Math.max(0.03, (v / 33.65) * chmax), bx = x + k * (bw + 0.06);
        s.addShape(R, { x: bx, y: cbase - h, w: bw, h, fill: { color: c }, line: { color: c } });
        s.addText(v.toFixed(2), { x: bx - 0.15, y: cbase - h - 0.24, w: bw + 0.3, h: 0.22, fontFace: B, fontSize: 9.5, bold: k === 1, color: INK, align: "center", margin: 0 });
      });
      s.addText(label, { x: gx + i * gw, y: cbase + 0.06, w: gw, h: 0.28, fontFace: B, fontSize: 10, color: SLATE, align: "center", margin: 0 });
    });
    s.addShape(R, { x: 0.5, y: cbase, w: 6.0, h: 0.015, fill: { color: "B9B4A8" }, line: { color: "B9B4A8" } });
    card(s, 6.85, 1.55, 2.65, 1.55, GOOD);
    s.addText("Better where it matters", { x: 7.08, y: 1.65, w: 2.3, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: GOOD, margin: 0 });
    s.addText("−6.7% overall, much better on long trips, +1.5% on short ones. Max prediction 57 → 125 min.",
      { x: 7.08, y: 1.97, w: 2.3, h: 1.05, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top" });
    card(s, 6.85, 3.45, 2.65, 1.45, BAD);
    s.addText("Known limit", { x: 7.08, y: 3.55, w: 2.3, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: BAD, margin: 0 });
    s.addText("Trips over an hour are still predicted about 20 min short: the features can't see crashes or weather.",
      { x: 7.08, y: 3.87, w: 2.3, h: 0.95, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top" });
    s.addNotes("The first version reported 3.96, but only because trips over an hour had been removed from both training and validation. After the review, long trips were kept and the headline rose to 4.79. That is not a worse model: on exactly the same trips, the new model wins overall and especially on long trips, at a small cost on short ones. The remaining weakness is honest and documented: very long trips are still underestimated.");
  }

  // ---------- 11. MLflow ----------
  {
    const s = content("TRACKING", "Every run recorded in MLflow");
    const items = [
      [fa.FaSlidersH, "Parameters", "Trees, depth, leaf size, rows, features, cleaning rules"],
      [fa.FaChartLine, "Metrics", "RMSE overall, ≤60 / >60 min, by distance, and bias"],
      [fa.FaBox, "Artifacts", "model.skops (safe format) and feature_importances.json"],
      [fa.FaListAlt, "56 runs", "Including two 25-trial Optuna searches as nested runs"],
    ];
    for (let i = 0; i < items.length; i++) {
      const y = 1.55 + i * 0.86;
      await badge(s, items[i][0], 0.5, y, 0.5);
      s.addText(items[i][1], { x: 1.15, y: y - 0.02, w: 3.9, h: 0.3, fontFace: B, fontSize: 13, bold: true, color: INK, margin: 0 });
      s.addText(items[i][2], { x: 1.15, y: y + 0.28, w: 4.05, h: 0.45, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top" });
    }
    codeBox(s, 5.4, 1.55, 4.1, 1.15, [
      { text: "# open the tracking UI", color: "B5B2AB" },
      { text: "uv run mlflow ui \\" },
      { text: "  --backend-store-uri \\" },
      { text: "  sqlite:///mlflow.db --port 5000", color: TAXI },
    ], 10.5);
    card(s, 5.4, 3.05, 4.1, 1.5, TAXI);
    s.addText("Two gotchas, both fixed", { x: 5.65, y: 3.17, w: 3.7, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    s.addText([
      { text: "MLflow 3.17 refuses the old ./mlruns folder store, so tracking moved to SQLite.", options: { bullet: { indent: 12 }, breakLine: true } },
      { text: "The new UI hid runs behind a GenAI \"Traces\" view; the experiment is now labelled as model training in code.", options: { bullet: { indent: 12 } } },
    ], { x: 5.65, y: 3.5, w: 3.7, h: 1.25, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top", paraSpaceAfter: 4 });
    s.addNotes("MLflow records what went into each run and what came out, so any result can be traced back and compared. Two practical problems came up with the newest MLflow: it no longer accepts a plain folder as storage, and its new interface hid the runs. Both are fixed in code so they cannot come back.");
  }

  // ---------- 12. API ----------
  {
    const s = content("SERVING", "Predictions over HTTP with FastAPI");
    const eps = [["GET", "/health", "Is the model loaded?"], ["POST", "/predict", "Trip in, minutes out"], ["GET", "/docs", "Interactive test page"]];
    eps.forEach(([m, p, d], i) => {
      const y = 1.55 + i * 0.62;
      s.addShape(R, { x: 0.5, y, w: 0.75, h: 0.42, fill: { color: m === "POST" ? TAXI : INK }, line: { color: m === "POST" ? TAXI : INK } });
      s.addText(m, { x: 0.5, y, w: 0.75, h: 0.42, fontFace: B, fontSize: 10, bold: true, color: m === "POST" ? INK : "FFFFFF", align: "center", margin: 0, valign: "middle" });
      s.addText(p, { x: 1.4, y, w: 1.3, h: 0.42, fontFace: MONO, fontSize: 12, bold: true, color: INK, margin: 0, valign: "middle" });
      s.addText(d, { x: 2.65, y, w: 2.3, h: 0.42, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "middle" });
    });
    const guards = [
      [fa.FaShieldAlt, "Bad input → 422", "zone 999, negative distance, date only"],
      [fa.FaGlobeAmericas, "UTC → New York time", "08:30Z is read as 3:30am"],
      [fa.FaTachometerAlt, "~16 ms per prediction", "model loaded once"],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 3.5 + i * 0.52;
      await badge(s, guards[i][0], 0.5, y, 0.38);
      s.addText([{ text: guards[i][1] + "  ", options: { bold: true, color: INK } }, { text: guards[i][2], options: { color: SLATE } }],
        { x: 1.0, y: y - 0.04, w: 4.2, h: 0.46, fontFace: B, fontSize: 10.5, margin: 0, valign: "middle" });
    }
    codeBox(s, 5.35, 1.55, 4.15, 3.45, [
      { text: "$ curl -X POST localhost:8000/predict \\", color: TAXI },
      { text: "    -d @sample-request.json", color: TAXI },
      { text: "" },
      { text: "{", color: "B5B2AB" },
      { text: '  "PULocationID": 161,' },
      { text: '  "DOLocationID": 236,' },
      { text: '  "trip_distance": 2.5,' },
      { text: '  "passenger_count": 1,' },
      { text: '  "tpep_pickup_datetime":' },
      { text: '      "2025-01-27T08:30:00"' },
      { text: "}", color: "B5B2AB" },
      { text: "" },
      { text: '→ {"duration_minutes": 17.24}', color: TAXI, bold: true },
    ], 11.5);
    s.addNotes("The API is a small FastAPI app. A request describes a trip; the response is the predicted duration. Input is validated before it reaches the model, times sent in UTC are converted to New York time to match training, and the model is loaded once at startup so each prediction takes about 16 milliseconds of compute.");
  }

  // ---------- 13. Testing & review ----------
  {
    const s = content("QUALITY", "Tested, reviewed, 9 issues fixed");
    s.addText("37", { x: 0.5, y: 1.5, w: 2.2, h: 1.0, fontFace: H, fontSize: 54, color: INK, margin: 0 });
    s.addText("automated tests, all passing\nin about 1.5 seconds", { x: 0.5, y: 2.5, w: 2.5, h: 0.55, fontFace: B, fontSize: 11, color: SLATE, margin: 0, valign: "top" });
    const groups = ["Cleaning", "Features", "Metrics", "Model", "API", "Paths & defaults"];
    groups.forEach((g, i) => {
      const x = 0.5 + (i % 2) * 1.22, y = 3.41 + Math.floor(i / 2) * 0.55;
      s.addShape(R, { x, y, w: 1.12, h: 0.42, fill: { color: CARD }, line: { color: LINE, width: 0.75 } });
      s.addText(g, { x, y, w: 1.12, h: 0.42, fontFace: B, fontSize: 9.5, bold: true, color: INK, align: "center", margin: 0, valign: "middle" });
    });
    const fixes = [
      ["UTC times read as local", "08:30Z predicted like 8:30am", "Convert to New York time"],
      ["Crashed outside project root", "Tests and API looked in the wrong folder", "Paths anchored to the project"],
      ["Training overwrote best model", "Default trained the weaker baseline", "Safe default, explicit flags"],
      ["60-min cutoff hid long trips", "Model couldn't predict > 57 min", "Keep 1–180 min, retrain"],
    ];
    s.addText("Highlights of the review (all 9 fixed)", { x: 3.25, y: 1.5, w: 6.2, h: 0.3, fontFace: B, fontSize: 11, bold: true, color: MUTED, margin: 0 });
    for (let i = 0; i < fixes.length; i++) {
      const y = 1.88 + i * 0.79;
      card(s, 3.25, y, 6.25, 0.68, BAD);
      s.addText(fixes[i][0], { x: 3.5, y: y + 0.06, w: 3.0, h: 0.3, fontFace: B, fontSize: 11.5, bold: true, color: INK, margin: 0 });
      s.addText(fixes[i][1], { x: 3.5, y: y + 0.35, w: 3.0, h: 0.28, fontFace: B, fontSize: 9.5, color: SLATE, margin: 0 });
      s.addImage({ data: await icon(fa.FaArrowRight, MUTED), x: 6.55, y: y + 0.24, w: 0.2, h: 0.2 });
      s.addText(fixes[i][2], { x: 6.9, y: y + 0.06, w: 2.5, h: 0.56, fontFace: B, fontSize: 10.5, bold: true, color: GOOD, margin: 0, valign: "middle" });
    }
    s.addNotes("Passing tests are not the same as correct software. After the first version passed all 22 of its tests, a review probing edge cases found nine problems, including wrong predictions for UTC timestamps and the 60-minute cutoff. Each fix came with a new test, bringing the total to 37, and the time-zone and date tests were checked to fail without their fix.");
  }

  // ---------- 14. Answers ----------
  {
    const s = content("THE TWO QUESTIONS", "Final RMSE and what's next");
    card(s, 0.5, 1.55, 3.6, 3.0, TAXI);
    s.addText("1 · Final model RMSE", { x: 0.75, y: 1.68, w: 3.2, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    s.addText("4.786", { x: 0.75, y: 2.05, w: 3.2, h: 0.85, fontFace: H, fontSize: 44, color: INK, margin: 0 });
    s.addText("minutes", { x: 0.75, y: 2.88, w: 3.2, h: 0.3, fontFace: B, fontSize: 12, color: MUTED, margin: 0 });
    s.addText("Jan 25–31: 792,583 trips of 1–180 min\nTrips up to an hour: 3.97\nPredicting the mean: 11.28",
      { x: 0.75, y: 3.3, w: 3.25, h: 1.5, fontFace: B, fontSize: 11.5, color: SLATE, margin: 0, valign: "top", paraSpaceAfter: 6 });
    s.addText("2 · With more time", { x: 4.45, y: 1.55, w: 5, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    const next = [
      [fa.FaMapMarkedAlt, "Better features", "Zone-pair history, holiday flag, weather, to fix long trips"],
      [fa.FaRocket, "Gradient boosting", "Usually more accurate, MB-sized models instead of 740 MB"],
      [fa.FaBalanceScale, "Better target", "Predict log(duration); report MAE beside RMSE"],
      [fa.FaDocker, "Production path", "Docker, MLflow Model Registry, monthly data checks"],
    ];
    for (let i = 0; i < next.length; i++) {
      const y = 1.98 + i * 0.76;
      await badge(s, next[i][0], 4.45, y, 0.46);
      s.addText(next[i][1], { x: 5.05, y: y - 0.03, w: 4.4, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
      s.addText(next[i][2], { x: 5.05, y: y + 0.26, w: 4.4, h: 0.32, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0 });
    }
    s.addNotes("The assignment asks two questions. The final RMSE is 4.786 minutes on the held-out week. With more time, the biggest gain would come from features that explain long, slow trips, followed by trying gradient boosting, which is typically more accurate and far smaller, and by packaging the service for production.");
  }

  // ---------- 15. Run it ----------
  {
    const s = pres.addSlide(); page += 1;
    s.background = { color: INK };
    checker(s, 0);
    s.addText("Run it yourself", { x: 0.6, y: 0.75, w: 8.8, h: 0.7, fontFace: H, fontSize: 32, color: "FFFFFF", margin: 0 });
    const cmds = [
      ["Install", "uv sync"],
      ["Test", "uv run pytest -q"],
      ["Train", "uv run python -m src.train"],
      ["Track", "uv run mlflow ui --backend-store-uri sqlite:///mlflow.db"],
      ["Serve", "uv run uvicorn app.main:app --port 8000"],
      ["Try", "open http://127.0.0.1:8000/docs"],
    ];
    cmds.forEach(([label, cmd], i) => {
      const y = 1.7 + i * 0.5;
      s.addText(label.toUpperCase(), { x: 0.6, y, w: 1.2, h: 0.38, fontFace: B, fontSize: 10, bold: true, color: TAXI, charSpacing: 2, margin: 0, valign: "middle" });
      s.addText(cmd, { x: 1.85, y, w: 7.5, h: 0.38, fontFace: MONO, fontSize: 13, color: "FFFFFF", margin: 0, valign: "middle" });
    });
    s.addText("Code, notebook, process log and errors log: github.com/Jassalam/model-deployment-project",
      { x: 0.6, y: 4.82, w: 8.8, h: 0.3, fontFace: B, fontSize: 11.5, color: "D8D6D0", margin: 0 });
    checker(s, 5.625 - 0.32);
    s.addNotes("Everything runs on one machine with six commands. The repository also contains the exploration notebook, a step-by-step process log, and a log of every error hit along the way and how it was fixed.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
