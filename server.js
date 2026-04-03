const express = require("express");
const cors = require("cors");

const app = express();

/* ===== FORCE CORS (VERY IMPORTANT) ===== */
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
  board1: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  board2: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  board3: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  board4: { voltage: 0, current: 0, power: 0, t1: 100, t2: 200, t3: 300 },
  temperature: 0,
  gas: 0
};

/* ===== TEST ROUTE ===== */
app.get("/", (req, res) => {
  res.send("Backend Running");
});

/* ===== RECEIVE ===== */
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

  res.send("OK");
});

/* ===== SEND ===== */
app.get("/api/data", (req, res) => {
  res.json(systemData);
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));