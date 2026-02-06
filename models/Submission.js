const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
  qrCode: String,

  name: String,
  phone: String,

  address: String,
  ownername: String,
  price: String,
  size: Number,
  bedrooms: String,
  baths: String,
  condition: String,

  images: [String], // image filenames

  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Submission", SubmissionSchema);