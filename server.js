const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* ===== SUPABASE CONFIG ===== */
const supabase = createClient(
  "https://tdawapextufttejeivps.supabase.co",
  "sb_publishable_UKNlHlpoKUICvhcH7Xdi9Q_2FCEZDvs"
);

/* ===== MIDDLEWARE ===== */
app.use(cors());
app.use(express.json());

/* ===== SYSTEM DATA ===== */
let systemData = {
  boards: {
    1: { voltage: 0, current: 0, power: 0, relay: true },
    2: { voltage: 0, current: 0, power: 0, relay: true },
    3: { voltage: 0, current: 0, power: 0, relay: true },
    4: { voltage: 0, current: 0, power: 0, relay: true }
  },
  temperature: 0,
  gas: 0,
  coolingFan: false,
  alerts: [],
  ai: {
    risk: "LOW",
    message: "System stable",
    score: 0
  }
};

/* ===== ALERT SYSTEM ===== */
function addAlert(msg) {
  const last = systemData.alerts.at(-1);
  if (last && last.message === msg) return;

  console.log("🚨", msg);

  systemData.alerts.push({
    message: msg,
    time: new Date()
  });

  if (systemData.alerts.length > 20) {
    systemData.alerts.shift();
  }
}

/* ===== AI FAULT PREDICTION ===== */
function runAI() {
  let riskScore = 0;
  let message = "System stable";

  for (let i = 1; i <= 4; i++) {
    const b = systemData.boards[i];

    // Rule-based AI (can upgrade to ML later)
    if (b.current > 15) riskScore += 30;
    if (b.power > 300) riskScore += 40;
    if (b.voltage < 5 && b.current > 10) {
      riskScore += 50;
      message = `⚠ Short Circuit suspected on Board ${i}`;
    }
  }

  if (systemData.temperature > 50) riskScore += 30;
  if (systemData.gas > 1) riskScore += 40;

  let risk = "LOW";
  if (riskScore > 80) risk = "CRITICAL";
  else if (riskScore > 50) risk = "HIGH";
  else if (riskScore > 25) risk = "MEDIUM";

  systemData.ai = { risk, message, score: riskScore };

  if (risk === "CRITICAL") {
    addAlert("🚨 AI detected CRITICAL fault risk!");
  }
}

/* ===== THRESHOLD LOGIC ===== */
function checkThresholds() {
  for (let i = 1; i <= 4; i++) {
    let b = systemData.boards[i];

    if (b.power > 400) {
      b.relay = false;
      addAlert(`⚡ Board ${i} power cut due to overload`);
    }
  }
}

/* ===== SAFETY ===== */
function checkSafety() {
  if (systemData.temperature > 50) {
    systemData.coolingFan = true;
    addAlert("🔥 High temperature detected");
  } else {
    systemData.coolingFan = false;
  }

  if (systemData.gas > 1) {
    addAlert("☠ Gas leakage detected");
  }
}

/* ===== SAVE DATA ===== */
async function saveToSupabase(data) {
  await supabase.from("sensor_data").insert([
    {
      board1_power: data.boards[1].power,
      board2_power: data.boards[2].power,
      board3_power: data.boards[3].power,
      board4_power: data.boards[4].power,
      temperature: data.temperature,
      gas: data.gas,
      ai_risk: data.ai.risk,
      ai_score: data.ai.score
    }
  ]);
}

/* ===== ROUTES ===== */

app.get("/", (req, res) => {
  res.send("🚀 AI Circuit Breaker Backend Running");
});

/* RECEIVE DATA */
app.post("/api/data", async (req, res) => {
  const incoming = req.body;

  console.log("📥 Incoming:", incoming);

  for (let i = 1; i <= 4; i++) {
    if (incoming[`board${i}`]) {
      let b = incoming[`board${i}`];
      systemData.boards[i].voltage = b.voltage || 0;
      systemData.boards[i].current = b.current || 0;
      systemData.boards[i].power =
        systemData.boards[i].voltage * systemData.boards[i].current;
    }
  }

  systemData.temperature = incoming.temperature ?? systemData.temperature;
  systemData.gas = incoming.gas ?? systemData.gas;

  checkThresholds();
  checkSafety();
  runAI();

  await saveToSupabase(systemData);

  res.json({ status: "OK", ai: systemData.ai });
});

/* SEND DATA */
app.get("/api/data", (req, res) => {
  res.json(systemData);
});

/* HISTORY */
app.get("/api/history", async (req, res) => {
  const { data } = await supabase
    .from("sensor_data")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  res.json(data);
});

/* START */
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));