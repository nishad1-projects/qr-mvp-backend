const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const QRCode = require("./models/QRCode");
const Submission = require("./models/Submission");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// DB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.log(err));

// Home route
app.get("/", (req, res) => {
  res.send("QR MVP Server running 🚀");
});

// Generate QR code
app.post("/generate-qr", async (req, res) => {
  const randomCode = Math.random().toString(36).substring(2, 10);

  const qr = new QRCode({
    code: randomCode
  });

  await qr.save();

  res.json({
    message: "QR created",
    code: randomCode,
    url: `http://localhost:5000/qr/${randomCode}`
  });
});

// Scan QR (show form until submitted)
app.get("/qr/:code", async (req, res) => {
  const { code } = req.params;

  const qr = await QRCode.findOne({ code });

  if (!qr) {
    return res.send("❌ Invalid QR code");
  }

  if (qr.isUsed) {
    return res.send("⚠️ Sorry, this QR code has already been used.");
  }

  res.send(`
    <h2>Submit Your Information</h2>
    <form method="POST" action="/submit/${code}">
      <input name="name" placeholder="Your Name" required /><br/><br/>
      <input name="phone" placeholder="Phone Number" required /><br/><br/>
      <button type="submit">Submit</button>
    </form>
  `);
});

// Submit form (lock QR)
app.post("/submit/:code", async (req, res) => {
  const { code } = req.params;
  const { name, phone } = req.body;

  const qr = await QRCode.findOne({ code });

  if (!qr) {
    return res.send("❌ Invalid QR code");
  }

  if (qr.isUsed) {
    return res.send("⚠️ This QR has already been used.");
  }

  await Submission.create({
  qrCode: code,
  name,
  phone
});

  qr.isUsed = true;
  await qr.save();

  res.send("✅ Thank you! Your information has been submitted.");
});

// Debug: view submissions
app.get("/debug/submissions", async (req, res) => {
  const data = await Submission.find();
  res.json(data);
});

app.get("/test", (req, res) => {
  res.send("TEST OK");
});

// imports
// middleware
// db connection

// routes
app.get("/ping", (req, res) => {
  res.send("PING OK");
});

// Public listings page (styled)
app.get("/listings", async (req, res) => {
  const submissions = await Submission.find().sort({ submittedAt: -1 });

  let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Public Listings</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background: #f4f6f8;
        margin: 0;
        padding: 20px;
      }
      h1 {
        text-align: center;
        margin-bottom: 30px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }
      .card {
        background: #fff;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      }
      .card p {
        margin: 6px 0;
      }
      .label {
        font-weight: bold;
        color: #555;
      }
    </style>
  </head>
  <body>
    <h1>Public Listings</h1>
    <div class="grid">
  `;

  submissions.forEach(item => {
    html += `
      <div class="card">
        <p><span class="label">Name:</span> ${item.name}</p>
        <p><span class="label">Phone:</span> ${item.phone}</p>
        <p><span class="label">QR Code:</span> ${item.qrCode}</p>
      </div>
    `;
  });

  html += `
    </div>
  </body>
  </html>
  `;

  res.send(html);
});

// 🚨 NOTHING AFTER THIS LINE EXCEPT app.listen
app.listen(5000, () => {
  console.log("Server started on port 5000");
});

