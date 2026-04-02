const express = require("express");
const app = express();

app.use(express.json());

/* ===== DATA STORAGE ===== */
let systemData = {
  board1: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  board2: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  board3: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  board4: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  temperature: 0,
  gas: 0
};

/* ===== RECEIVE DATA FROM ESP32 ===== */
app.post("/api/data", (req, res) => {
  const incoming = req.body;

  Object.keys(incoming).forEach(key => {
    if(systemData[key]) {
      systemData[key] = { ...systemData[key], ...incoming[key] };
    }
  });

  res.send("Data received");
});

/* ===== SEND DATA TO DASHBOARD ===== */
app.get("/api/data", (req, res) => {
  res.json(systemData);
});

/* ===== UPDATE THRESHOLDS ===== */
app.post("/api/config", (req, res) => {
  const { board, key, value } = req.body;

  systemData[`board${board}`][key] = Number(value);
  res.send("Updated");
});

/* ===== ML PREDICTION ===== */
app.post("/api/predict", (req, res) => {
  const data = req.body;

  let future = { b1: [], b2: [], b3: [], b4: [] };
  let risk = "LOW";
  let message = "System stable";

  for (let i = 1; i <= 4; i++) {
    let p = data[`board${i}`]?.power || 0;

    for (let t = 1; t <= 5; t++) {
      future[`b${i}`].push(p + t * 20);
    }

    if (p > 250) {
      risk = "HIGH";
      message = `⚠ Board ${i} overload soon`;
    }
  }

  res.json({ risk, message, future });
});

/* ===== START SERVER ===== */
app.listen(3000, () => console.log("Server running on port 3000"));