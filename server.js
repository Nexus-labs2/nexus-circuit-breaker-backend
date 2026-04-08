const axios = require("axios");
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* ===== SUPABASE CONFIG ===== */
const supabase = createClient(
  "https://tdawapextufttejeivps.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkYXdhcGV4dHVmdHRlamVpdnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDcxNTksImV4cCI6MjA5MTAyMzE1OX0.8g9g4wx2rURKhfYDkAdvfMUyp0vtO-ul4TESuw-LjwI"
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

  console.log("🚨 ALERT:", msg);

  systemData.alerts.push({
    message: msg,
    time: new Date()
  });

  if (systemData.alerts.length > 20) {
    systemData.alerts.shift();
  }
}

/* ===== AI LOGIC ===== */
const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
  board1_power: systemData.boards[1].power,
  board2_power: systemData.boards[2].power,
  board3_power: systemData.boards[3].power,
  board4_power: systemData.boards[4].power,
  temperature: systemData.temperature,
  gas: systemData.gas
});

systemData.ai.risk = mlResponse.data.risk;
systemData.ai.message = "ML Prediction Active 🚀";
/* ===== THRESHOLD ===== */
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

/* ===== SAVE TO SUPABASE ===== */
async function saveToSupabase(data) {
  try {
    const payload = {
      board1_power: data.boards?.[1]?.power ?? null,
      board2_power: data.boards?.[2]?.power ?? null,
      board3_power: data.boards?.[3]?.power ?? null,
      board4_power: data.boards?.[4]?.power ?? null,
      temperature: data.temperature ?? null,
      gas: data.gas ? true : false,

      // ⚡ Only include these if columns exist in DB
      ai_risk: data.ai?.risk ?? null,
      ai_score: data.ai?.score ?? null
    };

    console.log("📤 Supabase Payload:", payload);

    const { error } = await supabase
      .from("sensor_data")
      .insert([payload]);

    if (error) {
      console.error("❌ Supabase Insert Error:", error.message);
    } else {
      console.log("✅ Data inserted into Supabase");
    }

  } catch (err) {
    console.error("❌ Unexpected Error:", err.message);
  }
}

/* ===== ROUTES ===== */

app.get("/", (req, res) => {
  res.send("🚀 AI Circuit Breaker Backend Running");
});

/* ===== RECEIVE DATA ===== */
app.post("/api/data", async (req, res) => {
  try {
    const incoming = req.body;

    console.log("📥 Incoming:", incoming);

    for (let i = 1; i <= 4; i++) {
      if (incoming[`board${i}`]) {
        let b = incoming[`board${i}`];

        systemData.boards[i].voltage = b.voltage ?? 0;
        systemData.boards[i].current = b.current ?? 0;
        systemData.boards[i].power =
          systemData.boards[i].voltage * systemData.boards[i].current;
      }
    }

    if (incoming.temperature !== undefined) {
      systemData.temperature = incoming.temperature;
    }

    if (incoming.gas !== undefined) {
      systemData.gas = incoming.gas;
    }

    checkThresholds();
    checkSafety();
    runAI();

    await saveToSupabase(systemData);

    res.json({ status: "OK", ai: systemData.ai });

  } catch (err) {
    console.error("❌ API ERROR:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ===== SEND LIVE DATA ===== */
app.get("/api/data", (req, res) => {
  res.json(systemData);
});

/* ===== HISTORY ===== */
app.get("/api/history", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sensor_data")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ Fetch Error:", error.message);
      return res.status(500).send(error.message);
    }

    res.json(data);

  } catch (err) {
    res.status(500).send("Error fetching history");
  }
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});