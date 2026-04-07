const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/* ===== SUPABASE CONFIG ===== */
/* ⚠️ IMPORTANT: Replace with YOUR anon public key */
const supabase = createClient(
  "https://tdawapextufttejeivps.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkYXdhcGV4dHVmdHRlamVpdnBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ0NzE1OSwiZXhwIjoyMDkxMDIzMTU5fQ.-X1UN8LiibOQPtvg9seq9Ef6CH6tLSs7-KvVqjWyN2Y"
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
function runAI() {
  let riskScore = 0;
  let message = "System stable";

  for (let i = 1; i <= 4; i++) {
    const b = systemData.boards[i];

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
      board1_power: data.boards?.[1]?.power ?? 0,
      board2_power: data.boards?.[2]?.power ?? 0,
      board3_power: data.boards?.[3]?.power ?? 0,
      board4_power: data.boards?.[4]?.power ?? 0,
      temperature: data.temperature ?? 0,
      gas: data.gas ? true : false, // 🔥 FIXED
      ai_risk: data.ai?.risk ?? "LOW",
      ai_score: data.ai?.score ?? 0
    };

    console.log("📤 Sending to Supabase:", payload);

    const { error } = await supabase.from("sensor_data").insert([payload]);

    if (error) {
      console.error("❌ Supabase Insert Error:", error.message);
    } else {
      console.log("✅ Data inserted successfully");
    }

  } catch (err) {
    console.error("❌ Unexpected Error:", err.message);
  }
}

/* ===== ROUTES ===== */

app.get("/", (req, res) => {
  res.send("🚀 AI Circuit Breaker Backend Running");
});

/* RECEIVE DATA */
app.post("/api/data", async (req, res) => {
  try {
    const incoming = req.body;

    console.log("📥 Incoming:", JSON.stringify(incoming, null, 2));

    for (let i = 1; i <= 4; i++) {
      if (incoming[`board${i}`]) {
        let b = incoming[`board${i}`];

        systemData.boards[i].voltage = b.voltage ?? 0;
        systemData.boards[i].current = b.current ?? 0;
        systemData.boards[i].power =
          systemData.boards[i].voltage * systemData.boards[i].current;
      }
    }

    systemData.temperature = incoming.temperature ?? systemData.temperature;
    systemData.gas = incoming.gas ?? systemData.gas;

    checkThresholds();
    checkSafety();
    runAI();

    console.log("🧠 Final System Data:", JSON.stringify(systemData, null, 2));

    await saveToSupabase(systemData);

    res.json({ status: "OK", ai: systemData.ai });

  } catch (err) {
    console.error("❌ API ERROR:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* SEND DATA */
app.get("/api/data", (req, res) => {
  res.json(systemData);
});

/* HISTORY */
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

/* START SERVER */
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});