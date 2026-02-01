const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const QRCode = require("./models/QRCode");
const Submission = require("./models/Submission");

const app = express();
app.set("view engine", "ejs");

const multer = require("multer");
const path = require("path");

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per image
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//admin security session
const session = require("express-session");

app.use(session({
  secret: "qr-mvp-secret",
  resave: false,
  saveUninitialized: false
}));


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
    url: `https://qr-mvp-backend.onrender.com/qr/${randomCode}`
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

  // Render dedicated submission page
  res.render("submit-flat", { code });
});

// Submit form (lock QR + save apartment)
app.post("/submit/:code", upload.array("images", 5), async (req, res) => {
  try {
    const { code } = req.params;

    const qr = await QRCode.findOne({ code });
    if (!qr || qr.isUsed) {
      return res.send("Invalid or already used QR");
    }

    const imageFiles = req.files.map(file => file.filename);

    await Submission.create({
      qrCode: code,
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
      price: req.body.price,
      size: req.body.size,
      bedrooms: req.body.bedrooms,
      condition: req.body.condition,
      images: imageFiles
    });

    qr.isUsed = true;
    await qr.save();

    res.redirect("/thank-you");
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).send("Something went wrong. Please try again.");
  }
});

//Thank you page design
app.get("/thank-you", (req, res) => {
  res.send(`
    <h2>Thank You!</h2>
    <p>Your apartment information has been submitted successfully.</p>
  `);
});

app.use("/uploads", express.static("uploads"));

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
// API listings (for WordPress / frontend)
app.get("/api/listings", async (req, res) => {
  const submissions = await Submission.find().sort({ submittedAt: -1 });
  res.json(submissions);
});

// Admin login page
app.get("/admin/login", (req, res) => {
  res.render("admin/login");
});

// Handle login (very simple MVP auth)
app.post("/admin/login", (req, res) => {
  const { password } = req.body;

  if (password === "admin123") {
    req.session.isAdmin = true;
    res.redirect("/admin/dashboard");
  } else {
    res.send("Wrong password");
  }
});

// Admin dashboard page (with data)
app.get("/admin/dashboard", async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin/login");
  }

  const qrs = await QRCode.find().sort({ _id: -1 });
  const submissions = await Submission.find().sort({ submittedAt: -1 });

  res.render("admin/dashboard", { qrs, submissions });
});

//Added Logout admin
app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});


// 🚨 NOTHING AFTER THIS LINE EXCEPT app.listen
app.listen(5000, () => {
  console.log("Server started on port 5000");
});

