const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* ===== SUPABASE CONFIG ===== */
const supabase = createClient(
  "https://tdawapextufttejeivps.supabase.co",
  "sb_publishable_UKNlHlpoKUICvhcH7Xdi9Q_2FCEZDvs"
);

/* ===== CORS ===== */
app.use(cors());
app.use(express.json());

/* ===== DATA ===== */
let systemData = {
  board1: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300, relay: true },
  board2: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300, relay: true },
  board3: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300, relay: true },
  board4: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300, relay: true },

  temperature: 0,
  gas: 0,

  coolingFan: false,
  alerts: []
};

/* ===== TEST ===== */
app.get("/", (req, res) => {
  res.send("Backend Running 🚀");
});

/* ===== ALERT FUNCTION (NO SPAM) ===== */
function addAlert(msg) {
  const last = systemData.alerts[systemData.alerts.length - 1];

  if (last && last.message === msg) return; // prevent duplicate spam

  console.log("ALERT:", msg);

  systemData.alerts.push({
    message: msg,
    time: new Date()
  });

  if (systemData.alerts.length > 20) {
    systemData.alerts.shift();
  }
}

/* ===== THRESHOLD CHECK ===== */
function checkThresholds() {
  for (let i = 1; i <= 4; i++) {
    let board = systemData[`board${i}`];
    if (!board) continue;

    if (board.power >= board.t1 && board.power < board.t2) {
      addAlert(`⚠ Board ${i} reached Threshold 1`);
    }

    if (board.power >= board.t2 && board.power < board.t3) {
      addAlert(`⚡ Board ${i} reached Threshold 2`);
    }

    if (board.power >= board.t3) {
      board.relay = false;
      addAlert(`🚨 Board ${i} exceeded Threshold 3 → POWER CUT`);
    }
  }
}

/* ===== SAFETY CHECK ===== */
function checkSafety() {
  if (systemData.temperature > 50) {
    systemData.coolingFan = true;
    addAlert("🔥 High Temperature! Cooling Fan Activated");
  } else {
    systemData.coolingFan = false;
  }

  if (systemData.gas > 1) {
    addAlert("☠ Gas Leakage Detected!");
  }
}

/* ===== SAVE TO SUPABASE ===== */
async function saveToSupabase(data) {
  const { error } = await supabase.from("sensor_data").insert([
    {
      board1_power: data.board1?.power ?? null,
      board2_power: data.board2?.power ?? null,
      board3_power: data.board3?.power ?? null,
      board4_power: data.board4?.power ?? null,
      temperature: data.temperature ?? null,
      gas: data.gas ?? null
    }
  ]);

  if (error) {
    console.error("❌ Supabase Error:", error.message);
  } else {
    console.log("✅ Data saved to Supabase");
  }
}

/* ===== RECEIVE DATA ===== */
app.post("/api/data", async (req, res) => {
  const incoming = req.body;

  console.log("DATA RECEIVED:", incoming);

  // Merge board data safely
  for (let i = 1; i <= 4; i++) {
    if (incoming[`board${i}`]) {
      systemData[`board${i}`] = {
        ...systemData[`board${i}`],
        ...incoming[`board${i}`]
      };
    }
  }

  // Merge global values
  if (incoming.temperature !== undefined) {
    systemData.temperature = incoming.temperature;
  }

  if (incoming.gas !== undefined) {
    systemData.gas = incoming.gas;
  }

  // Recalculate power
  for (let i = 1; i <= 4; i++) {
    let b = systemData[`board${i}`];
    b.power = (b.voltage ?? 0) * (b.current ?? 0);
  }

  // Run logic
  checkThresholds();
  checkSafety();

  // Save to Supabase
  await saveToSupabase(systemData);

  res.send("OK");
});

/* ===== SEND DATA ===== */
app.get("/api/data", (req, res) => {
  res.json(systemData);
});

/* ===== HISTORY FROM SUPABASE ===== */
app.get("/api/history", async (req, res) => {
  const { data, error } = await supabase
    .from("sensor_data")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).send(error.message);
  }

  res.json(data);
});

/* ===== ML + FAULT DETECTION ===== */
app.post("/api/predict", (req, res) => {
  const data = req.body;

  let future = { b1: [], b2: [], b3: [], b4: [] };
  let risk = "LOW";
  let message = "System stable";

  for (let i = 1; i <= 4; i++) {
    let v = data[`board${i}`]?.voltage || 0;
    let c = data[`board${i}`]?.current || 0;
    let p = v * c;

    for (let t = 1; t <= 10; t++) {
      future[`b${i}`].push(p + t * 20);
    }

    if (v < 5 && c > 10) {
      risk = "CRITICAL";
      message = `⚠ Short Circuit in Board ${i}`;
    }

    if (p > 350) {
      risk = "HIGH";
      message = `⚡ Power Surge in Board ${i}`;
    }

    if (c > 15) {
      risk = "MEDIUM";
      message = `⚠ Abnormal Current in Board ${i}`;
    }
  }

  res.json({ risk, message, future });
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));