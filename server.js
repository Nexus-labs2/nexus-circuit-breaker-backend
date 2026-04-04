const express = require("express");
const cors = require("cors");

const app = express();

/* ===== CORS ===== */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

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

/* ===== ALERT FUNCTION ===== */
function addAlert(msg) {
  console.log("ALERT:", msg);
  systemData.alerts.push({
    message: msg,
    time: new Date()
  });

  // Keep last 20 alerts only
  if (systemData.alerts.length > 20) {
    systemData.alerts.shift();
  }
}

/* ===== THRESHOLD CHECK ===== */
function checkThresholds() {
  for (let i = 1; i <= 4; i++) {
    let board = systemData[`board${i}`];

    if (!board) continue;

    // Threshold 1
    if (board.power >= board.t1 && board.power < board.t2) {
      addAlert(`⚠ Board ${i} reached Threshold 1`);
    }

    // Threshold 2
    if (board.power >= board.t2 && board.power < board.t3) {
      addAlert(`⚡ Board ${i} reached Threshold 2 (High Usage)`);
    }

    // Threshold 3 (AUTO SHUTDOWN)
    if (board.power >= board.t3) {
      board.relay = false;
      addAlert(`🚨 Board ${i} exceeded Threshold 3 → POWER CUT`);
    }
  }
}

/* ===== SAFETY CHECK ===== */
function checkSafety() {

  // Temperature check
  if (systemData.temperature > 50) {
    systemData.coolingFan = true;
    addAlert("🔥 High Temperature! Cooling Fan Activated");
  } else {
    systemData.coolingFan = false;
  }

  // Gas detection
  if (systemData.gas > 1) {
    addAlert("☠ Gas Leakage Detected!");
  }
}

/* ===== RECEIVE DATA ===== */
app.post("/api/data", (req, res) => {
  const incoming = req.body;

  console.log("DATA RECEIVED:", incoming);

  Object.keys(incoming).forEach(key => {
    if (systemData[key]) {
      systemData[key] = {
        ...systemData[key],
        ...incoming[key]
      };
    }
  });

  // Recalculate power
  for (let i = 1; i <= 4; i++) {
    let b = systemData[`board${i}`];
    b.power = b.voltage * b.current;
  }

  // Run logic
  checkThresholds();
  checkSafety();

  res.send("OK");
});

/* ===== SEND DATA ===== */
app.get("/api/data", (req, res) => {
  res.json(systemData);
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

    // Prediction
    for (let t = 1; t <= 10; t++) {
      future[`b${i}`].push(p + t * 20);
    }

    /* ===== FAULT DETECTION LOGIC ===== */

    // Short circuit detection
    if (v < 5 && c > 10) {
      risk = "CRITICAL";
      message = `⚠ Possible Short Circuit in Board ${i}`;
    }

    // Sudden spike detection
    if (p > 350) {
      risk = "HIGH";
      message = `⚡ Power Surge in Board ${i}`;
    }

    // Abnormal fluctuation
    if (c > 15) {
      risk = "MEDIUM";
      message = `⚠ Abnormal Current in Board ${i}`;
    }
  }

  res.json({ risk, message, future });
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));