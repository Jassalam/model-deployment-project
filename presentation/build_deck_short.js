// Short 6-slide version of the project deck. Same style as build_deck.js.
// Run: NODE_PATH=<dir with pptxgenjs, react, react-dom, react-icons, sharp> node build_deck_short.js
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

const OUT = process.argv[2] || "nyc-taxi-trip-duration-short.pptx";

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
  pres.title = "Predicting NYC Taxi Trip Duration (summary)";
  const R = pres.shapes.RECTANGLE, O = pres.shapes.OVAL;
  let page = 0;

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
    s.addText(String(page) + " / 6", { x: 8.5, y: 5.2, w: 1, h: 0.25, fontFace: B, fontSize: 9, color: MUTED, margin: 0, align: "right" });
    return s;
  }

  function card(s, x, y, w, h, accent = TAXI) {
    s.addShape(R, { x, y, w, h, fill: { color: CARD }, line: { color: LINE, width: 0.75 } });
    s.addShape(R, { x, y, w: 0.07, h, fill: { color: accent }, line: { color: accent } });
  }

  function codeBox(s, x, y, w, h, lines, size = 10) {
    s.addShape(R, { x, y, w, h, fill: { color: INK }, line: { color: INK } });
    s.addText(lines.map((t, i) => ({
      text: t.text, options: { color: t.color || "E8E6E1", bold: !!t.bold, breakLine: i < lines.length - 1 },
    })), { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: h - 0.2, fontFace: MONO, fontSize: size, valign: "middle", margin: 0, paraSpaceAfter: 2 });
  }

  // ---------- 1. Title ----------
  {
    const s = pres.addSlide(); page += 1;
    s.background = { color: INK };
    checker(s, 0);
    s.addText("MODEL DEPLOYMENT PROJECT  ·  JANUARY 2025 DATA", { x: 0.6, y: 0.85, w: 5.8, h: 0.3, fontFace: B, fontSize: 10, bold: true, color: TAXI, charSpacing: 3, margin: 0 });
    s.addText("Predicting NYC Taxi Trip Duration", { x: 0.6, y: 1.2, w: 5.8, h: 1.45, fontFace: H, fontSize: 34, color: "FFFFFF", margin: 0, valign: "top" });
    s.addText("Given a trip at pickup (zones, distance, time, passengers), predict how many minutes it will take, and serve that prediction over HTTP.",
      { x: 0.6, y: 2.75, w: 5.6, h: 0.85, fontFace: B, fontSize: 13, color: "C9C7C2", margin: 0, valign: "top" });
    const stack = [[fa.FaTree, "scikit-learn"], [fa.FaFlask, "MLflow"], [fa.FaBolt, "FastAPI"], [fa.FaVial, "pytest · Optuna"]];
    for (let i = 0; i < stack.length; i++) {
      const x = 0.6 + i * 1.42;
      await badge(s, stack[i][0], x, 3.85, 0.36);
      s.addText(stack[i][1], { x: x + 0.43, y: 3.85, w: 1.0, h: 0.36, fontFace: B, fontSize: 9.5, bold: true, color: "FFFFFF", margin: 0, valign: "middle" });
    }
    s.addShape(R, { x: 6.75, y: 1.2, w: 2.65, h: 2.95, fill: { color: "22242A" }, line: { color: TAXI, width: 1.5 } });
    s.addText("4.79", { x: 6.75, y: 1.4, w: 2.65, h: 1.0, fontFace: H, fontSize: 54, color: TAXI, align: "center", margin: 0 });
    s.addText("minutes RMSE on the\nheld-out final week", { x: 6.85, y: 2.4, w: 2.45, h: 0.6, fontFace: B, fontSize: 12, color: "FFFFFF", align: "center", margin: 0 });
    s.addText("3.31M clean trips\n37 tests  ·  3 merged PRs", { x: 6.85, y: 3.2, w: 2.45, h: 0.6, fontFace: B, fontSize: 10, color: "C9C7C2", align: "center", margin: 0 });
    checker(s, 5.625 - 0.32);
    s.addNotes("This project predicts how long a New York yellow-taxi ride will take, using only what is known when the ride starts. I trained a Random Forest on January 2025 trips, tracked every experiment in MLflow, served the model with FastAPI, and covered it with 37 tests. The final model is off by about 4.8 minutes (RMSE) on the last week of January, which it never saw during training.");
  }

  // ---------- 2. Approach ----------
  {
    const s = content("THE APPROACH", "From raw trips to a live API");
    const steps = [
      [fa.FaCloudDownloadAlt, "Download", "src/data.py"],
      [fa.FaFilter, "Clean", "src/data.py"],
      [fa.FaSlidersH, "Features", "src/features.py"],
      [fa.FaTree, "Train", "src/train.py"],
      [fa.FaFlask, "Track", "mlflow.db"],
      [fa.FaBolt, "Serve", "app/main.py"],
    ];
    const w = 1.3, gap = 0.22, y = 1.5;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.55 + i * (w + gap);
      s.addShape(R, { x, y, w, h: 1.2, fill: { color: CARD }, line: { color: LINE, width: 0.75 } });
      s.addText(String(i + 1), { x: x + 0.08, y: y + 0.06, w: 0.3, h: 0.25, fontFace: H, fontSize: 10, color: MUTED, margin: 0 });
      await badge(s, steps[i][0], x + (w - 0.45) / 2, y + 0.12, 0.45);
      s.addText(steps[i][1], { x, y: y + 0.62, w, h: 0.28, fontFace: B, fontSize: 12, bold: true, color: INK, align: "center", margin: 0 });
      s.addText(steps[i][2], { x, y: y + 0.88, w, h: 0.22, fontFace: MONO, fontSize: 8.5, bold: true, color: SLATE, align: "center", margin: 0 });
      if (i < steps.length - 1)
        s.addShape(R, { x: x + w + 0.04, y: y + 0.33, w: gap - 0.08, h: 0.05, fill: { color: TAXI }, line: { color: TAXI } });
    }

    // Features (left)
    card(s, 0.5, 2.95, 4.35, 2.05, GOOD);
    s.addText("6 FEATURES, ALL KNOWN AT PICKUP", { x: 0.75, y: 3.05, w: 4, h: 0.28, fontFace: B, fontSize: 10, bold: true, color: GOOD, charSpacing: 1, margin: 0, valign: "middle" });
    const feats = ["Pickup zone", "Dropoff zone", "Trip distance", "Passengers (blank → 1)", "Pickup hour (NY time)", "Day of week"];
    for (let i = 0; i < feats.length; i++) {
      const fx = 0.78 + Math.floor(i / 3) * 2.0, fy = 3.42 + (i % 3) * 0.32;
      s.addImage({ data: await icon(fa.FaCheck, GOOD), x: fx, y: fy + 0.06, w: 0.16, h: 0.16 });
      s.addText(feats[i], { x: fx + 0.24, y: fy, w: 1.8, h: 0.28, fontFace: B, fontSize: 10.5, color: INK, margin: 0, valign: "middle" });
    }
    s.addText([
      { text: "Excluded: ", options: { bold: true, color: BAD } },
      { text: "fare, tip, tolls, total, dropoff time. They exist only after the ride, and fare tracks duration (rank corr. 0.87), so it would leak the answer." },
    ], { x: 0.75, y: 4.4, w: 3.95, h: 0.55, fontFace: B, fontSize: 9.5, color: SLATE, margin: 0, valign: "top" });

    // Time split (right)
    const x0 = 5.15, W = 4.35, d2x = (d) => x0 + ((d - 1) / 31) * W;
    s.addText("Test on the future, not at random", { x: x0, y: 2.95, w: W, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    s.addShape(R, { x: d2x(1), y: 3.35, w: d2x(25) - d2x(1), h: 0.48, fill: { color: INK }, line: { color: INK } });
    s.addShape(R, { x: d2x(25), y: 3.35, w: d2x(32) - d2x(25), h: 0.48, fill: { color: TAXI }, line: { color: TAXI } });
    s.addText("TRAIN  ·  Jan 1–24", { x: d2x(1) + 0.12, y: 3.35, w: 2.8, h: 0.48, fontFace: B, fontSize: 10.5, bold: true, color: "FFFFFF", margin: 0, valign: "middle" });
    s.addText("VALIDATE", { x: d2x(25), y: 3.35, w: d2x(32) - d2x(25), h: 0.48, fontFace: B, fontSize: 8.5, bold: true, color: INK, align: "center", margin: 0, valign: "middle" });
    s.addShape(R, { x: d2x(18), y: 3.89, w: d2x(25) - d2x(18), h: 0.26, fill: { color: "5C6370" }, line: { color: "5C6370" } });
    s.addText("Optuna", { x: d2x(18), y: 3.89, w: d2x(25) - d2x(18), h: 0.26, fontFace: B, fontSize: 8.5, bold: true, color: "FFFFFF", align: "center", margin: 0, valign: "middle" });
    ["1", "18", "25", "31"].forEach((d) => s.addText(d, { x: d2x(+d) - 0.2, y: 4.18, w: 0.4, h: 0.2, fontFace: B, fontSize: 8.5, color: MUTED, align: "center", margin: 0 }));
    s.addText("2,517,854 training trips · 792,583 validation trips. Tuning was scored on Jan 18–24, so the final week is used only once, for the final score.",
      { x: x0, y: 4.45, w: W, h: 0.55, fontFace: B, fontSize: 9.5, color: SLATE, margin: 0, valign: "top" });

    s.addNotes("Six stages, one module each. Training and the API call the same prepare_features() function, so serving can never prepare inputs differently from training. The model uses six fields that exist when the ride starts; fare and tip are left out because they are only known afterwards and would leak the answer. The split is by date: train on January 1 to 24, validate on 25 to 31. That mimics real use, which is always predicting the future.");
  }

  // ---------- 3. Data & cleaning ----------
  {
    const s = content("THE DATA", "3.48M messy trips, cleaned by rules");
    const stats = [
      ["3,475,226", "raw trips in January 2025", INK],
      ["−51,472", "minutes: 'shortest' trip (clock errors)", BAD],
      ["15.5%", "of rows missing passenger count", INK],
      ["52,533", "refund pairs: one trip recorded twice", BAD],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.5 + (i % 2) * 2.1, y = 1.55 + Math.floor(i / 2) * 1.6;
      card(s, x, y, 1.95, 1.4, stats[i][2] === BAD ? BAD : TAXI);
      s.addText(stats[i][0], { x: x + 0.2, y: y + 0.15, w: 1.7, h: 0.5, fontFace: H, fontSize: 18, color: stats[i][2], margin: 0, valign: "middle" });
      s.addText(stats[i][1], { x: x + 0.2, y: y + 0.7, w: 1.65, h: 0.6, fontFace: B, fontSize: 10, color: SLATE, margin: 0, valign: "top" });
    }

    const rules = [
      ["Duration 1–180 min", "Drops clock errors and meters left running"],
      ["Speed 1–65 mph", "Drops GPS/meter faults and impossible speeds"],
      ["Distance > 0 and ≤ 100 mi", "Drops zero and absurd odometer values"],
      ["Pickup in January 2025", "Drops stray December/February timestamps"],
      ["Refund pairs counted once", "Same trip with a negated fare: keep one row"],
    ];
    rules.forEach(([r, why], i) => {
      const y = 1.55 + i * 0.5;
      s.addShape(R, { x: 4.9, y: y + 0.05, w: 0.11, h: 0.38, fill: { color: TAXI }, line: { color: TAXI } });
      s.addText(r, { x: 5.15, y, w: 4.35, h: 0.25, fontFace: B, fontSize: 11.5, bold: true, color: INK, margin: 0, valign: "middle" });
      s.addText(why, { x: 5.15, y: y + 0.24, w: 4.35, h: 0.24, fontFace: B, fontSize: 9.5, color: SLATE, margin: 0, valign: "middle" });
    });
    s.addText("95.3%", { x: 4.9, y: 4.12, w: 1.6, h: 0.45, fontFace: H, fontSize: 24, color: INK, margin: 0, valign: "middle" });
    s.addText("kept: 3,310,437 of 3,475,226 trips", { x: 6.5, y: 4.12, w: 3.0, h: 0.45, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "middle" });
    const kw = 4.6 * 0.953;
    s.addShape(R, { x: 4.9, y: 4.65, w: kw, h: 0.25, fill: { color: TAXI }, line: { color: TAXI } });
    s.addShape(R, { x: 4.9 + kw, y: 4.65, w: 4.6 - kw, h: 0.25, fill: { color: BAD }, line: { color: BAD } });

    s.addNotes("Real data is messy: negative and multi-day durations, distances of hundreds of thousands of miles, 15 percent missing passenger counts, and 52,533 trips recorded twice because of refunds. Each rule came from looking at the data. Trips over an hour have a median speed of about 15 mph, so most are real; that's why the rules keep trips up to 180 minutes and use a speed check to remove broken records. 95.3 percent of trips survive.");
  }

  // ---------- 4. Results ----------
  {
    const s = content("RESULTS", "More data beat tuning");
    const rows = [
      ["Always predict the mean", "no model", 11.278, "D9D5CB"],
      ["Baseline forest", "500k rows · 254 MB", 4.954, "9A9790"],
      ["Optuna-tuned forest", "500k rows · 1,683 MB", 4.863, "9A9790"],
      ["Baseline settings, all data", "2.52M rows · 740 MB · served", 4.786, TAXI],
    ];
    s.addText("Validation RMSE, minutes (lower is better)", { x: 0.5, y: 1.48, w: 6, h: 0.3, fontFace: B, fontSize: 11, bold: true, color: MUTED, margin: 0 });
    const bx = 2.75, bmax = 3.0;
    rows.forEach(([name, sub, v, c], i) => {
      const y = 1.88 + i * 0.68;
      s.addText(name, { x: 0.5, y, w: 2.2, h: 0.28, fontFace: B, fontSize: 11, bold: true, color: INK, margin: 0 });
      s.addText(sub, { x: 0.5, y: y + 0.27, w: 2.2, h: 0.25, fontFace: B, fontSize: 9, color: MUTED, margin: 0 });
      const w = (v / 11.278) * bmax;
      s.addShape(R, { x: bx, y: y + 0.03, w, h: 0.45, fill: { color: c }, line: { color: c } });
      s.addText(v.toFixed(3), { x: bx + w + 0.08, y: y + 0.03, w: 0.8, h: 0.45, fontFace: H, fontSize: 12, color: INK, margin: 0, valign: "middle" });
    });
    s.addShape(R, { x: 0.5, y: 4.62, w: 6.0, h: 0.015, fill: { color: "B9B4A8" }, line: { color: "B9B4A8" } });
    s.addText([
      { text: "What drives it: ", options: { bold: true, color: INK } },
      { text: "distance is 84% of feature importance; traffic is the rest (16 mph at 5am, 8.5 mph mid-afternoon)." },
    ], { x: 0.5, y: 4.68, w: 6.1, h: 0.42, fontFace: B, fontSize: 10, color: SLATE, margin: 0, valign: "middle" });

    card(s, 6.85, 1.55, 2.65, 1.7);
    s.addText("Was tuning worth it?", { x: 7.08, y: 1.63, w: 2.3, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    s.addText("No.", { x: 7.08, y: 1.92, w: 2.3, h: 0.45, fontFace: H, fontSize: 22, color: BAD, margin: 0, valign: "middle" });
    s.addText("25 Optuna trials: −1.8% error for a 6.6× bigger file. All the data with plain settings: −3.4%.",
      { x: 7.08, y: 2.4, w: 2.3, h: 0.8, fontFace: B, fontSize: 9.5, color: SLATE, margin: 0, valign: "top" });

    card(s, 6.85, 3.4, 2.65, 1.7, GOOD);
    s.addText("v1 → v2: keep long trips", { x: 7.08, y: 3.48, w: 2.35, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: GOOD, margin: 0 });
    s.addText([
      { text: "Same 792,583 trips:", options: { bold: true, color: INK, breakLine: true } },
      { text: "all trips 5.13 → 4.79", options: { breakLine: true } },
      { text: "over 60 min 33.65 → 27.23", options: { breakLine: true } },
      { text: "Long trips still run ~20 min short." },
    ], { x: 7.08, y: 3.8, w: 2.35, h: 1.25, fontFace: B, fontSize: 9.5, color: SLATE, margin: 0, valign: "top", paraSpaceAfter: 2 });

    s.addNotes("All forests beat the naive mean predictor by more than half. Tuning with Optuna improved error by under 2 percent but made the model almost seven times bigger; simply training on all the data did better, so that is the served model, with RMSE 4.786. The first version cut trips at 60 minutes and reported a flattering 3.96; after keeping long trips, the new model is better on exactly the same trips, though trips over an hour are still underestimated by about 20 minutes.");
  }

  // ---------- 5. Engineering ----------
  {
    const s = content("ENGINEERING", "Tracked, served and tested");
    const cols = [
      [fa.FaFlask, "MLflow tracking"],
      [fa.FaBolt, "FastAPI serving"],
      [fa.FaVial, "Tests & review"],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.5 + i * 3.05;
      card(s, x, 1.55, 2.9, 3.45);
      await badge(s, cols[i][0], x + 0.25, 1.72, 0.48);
      s.addText(cols[i][1], { x: x + 0.85, y: 1.72, w: 1.95, h: 0.48, fontFace: B, fontSize: 13, bold: true, color: INK, margin: 0, valign: "middle" });
    }
    // MLflow
    s.addText("56", { x: 0.75, y: 2.35, w: 1.0, h: 0.55, fontFace: H, fontSize: 28, color: INK, margin: 0, valign: "middle" });
    s.addText("runs logged", { x: 1.38, y: 2.35, w: 1.8, h: 0.55, fontFace: B, fontSize: 11, color: SLATE, margin: 0, valign: "middle" });
    s.addText([
      { text: "Params, RMSE by segment, bias, model file", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "SQLite backend (MLflow 3.17 refuses ./mlruns)", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "Experiment tagged so the new UI shows runs", options: { bullet: { indent: 10 } } },
    ], { x: 0.75, y: 3.0, w: 2.5, h: 1.9, fontFace: B, fontSize: 10, color: SLATE, margin: 0, valign: "top", paraSpaceAfter: 5 });

    // API
    const eps = [["GET", "/health"], ["POST", "/predict"], ["GET", "/docs"]];
    eps.forEach(([m, p], i) => {
      const y = 2.38 + i * 0.36;
      const c = m === "POST" ? TAXI : INK;
      s.addShape(R, { x: 3.8, y, w: 0.6, h: 0.28, fill: { color: c }, line: { color: c } });
      s.addText(m, { x: 3.8, y, w: 0.6, h: 0.28, fontFace: B, fontSize: 8.5, bold: true, color: m === "POST" ? INK : "FFFFFF", align: "center", margin: 0, valign: "middle" });
      s.addText(p, { x: 4.5, y, w: 1.6, h: 0.28, fontFace: MONO, fontSize: 10.5, bold: true, color: INK, margin: 0, valign: "middle" });
    });
    s.addText([
      { text: "2.5 mi, Mon 8:30am → 17.24 min", options: { bold: true, color: INK, bullet: { indent: 10 }, breakLine: true } },
      { text: "Bad input (zone 999, no time) → 422", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "UTC times converted to NY time", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "Model loaded once, ~16 ms per call", options: { bullet: { indent: 10 } } },
    ], { x: 3.8, y: 3.5, w: 2.5, h: 1.45, fontFace: B, fontSize: 10, color: SLATE, margin: 0, valign: "top", paraSpaceAfter: 4 });

    // Tests
    s.addText("37", { x: 6.85, y: 2.35, w: 1.0, h: 0.55, fontFace: H, fontSize: 28, color: INK, margin: 0, valign: "middle" });
    s.addText("tests, pass in ~1.5 s", { x: 7.48, y: 2.35, w: 1.85, h: 0.55, fontFace: B, fontSize: 11, color: SLATE, margin: 0, valign: "middle" });
    s.addText("A review found 9 bugs the first 22 tests missed. Each fix got a test:", { x: 6.85, y: 3.0, w: 2.45, h: 0.5, fontFace: B, fontSize: 10, color: SLATE, margin: 0, valign: "top" });
    s.addText([
      { text: "UTC times read as local", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "Paths broke outside the root", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "Default trained the weaker model", options: { bullet: { indent: 10 }, breakLine: true } },
      { text: "60-min cutoff hid long trips", options: { bullet: { indent: 10 } } },
    ], { x: 6.85, y: 3.55, w: 2.45, h: 1.4, fontFace: B, fontSize: 10, bold: true, color: INK, margin: 0, valign: "top", paraSpaceAfter: 4 });

    s.addNotes("MLflow records every run's settings, metrics and model, 56 runs in total; two quirks of MLflow 3.17 were fixed in code. The FastAPI app validates input, converts UTC times to New York time to match training, and answers in about 16 milliseconds. Testing went beyond 'it passes': after the first 22 tests passed, a review found nine real bugs, including UTC handling and the 60-minute cutoff. Each fix added a test, giving 37.");
  }

  // ---------- 6. Answers & next ----------
  {
    const s = content("THE TWO QUESTIONS", "Final RMSE and what's next");
    card(s, 0.5, 1.55, 3.4, 2.35, TAXI);
    s.addText("1 · Final model RMSE", { x: 0.75, y: 1.65, w: 3.0, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    s.addText("4.786 min", { x: 0.75, y: 1.98, w: 3.1, h: 0.7, fontFace: H, fontSize: 32, color: INK, margin: 0, valign: "middle" });
    s.addText("Jan 25–31, 792,583 trips of 1–180 min\nTrips up to an hour: 3.97\nPredicting the mean: 11.28",
      { x: 0.75, y: 2.8, w: 3.05, h: 1.0, fontFace: B, fontSize: 10.5, color: SLATE, margin: 0, valign: "top", paraSpaceAfter: 3 });

    s.addText("2 · With more time", { x: 4.3, y: 1.55, w: 5, h: 0.3, fontFace: B, fontSize: 12, bold: true, color: INK, margin: 0 });
    const next = [
      [fa.FaMapMarkedAlt, "Better features", "Zone-pair history, holiday flag, weather"],
      [fa.FaRocket, "Gradient boosting", "Usually more accurate, MB-sized not 740 MB"],
      [fa.FaBalanceScale, "Better target", "Predict log(duration); report MAE too"],
      [fa.FaDocker, "Production path", "Docker, Model Registry, data drift checks"],
    ];
    for (let i = 0; i < next.length; i++) {
      const y = 1.95 + i * 0.5;
      await badge(s, next[i][0], 4.3, y, 0.4);
      s.addText([
        { text: next[i][1] + "  ", options: { bold: true, color: INK } },
        { text: next[i][2], options: { color: SLATE } },
      ], { x: 4.85, y, w: 4.65, h: 0.4, fontFace: B, fontSize: 10.5, margin: 0, valign: "middle" });
    }

    codeBox(s, 0.5, 4.1, 9.0, 0.95, [
      { text: "uv sync && uv run pytest -q                 # install, run 37 tests", color: "E8E6E1" },
      { text: "uv run python -m src.train                  # train, log to MLflow", color: "E8E6E1" },
      { text: "uv run uvicorn app.main:app --port 8000     # serve, then open /docs", color: TAXI, bold: true },
    ], 10);

    s.addNotes("The assignment asks two questions. The final RMSE is 4.786 minutes on the held-out last week of January. With more time, the biggest win would be features that explain long, slow trips, then gradient boosting, which is usually more accurate and far smaller than a 740 MB forest, then packaging for production. The last three commands are all it takes to reproduce everything on one machine.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
