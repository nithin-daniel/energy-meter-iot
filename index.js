// index.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = 4000;

// Energy Meter Schema
const energyMeterSchema = new mongoose.Schema({
  voltage: {
    type: Number,
    required: false,
  },
  current: {
    type: Number,
    required: false,
  },
  power: {
    type: Number,
    required: false,
  },
  energy: {
    type: Number,
    required: false,
  },
  frequency: {
    type: Number,
    required: false,
  },
  powerFactor: {
    type: Number,
    required: false,
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // This adds createdAt and updatedAt fields automatically
});

// Create indexes for better query performance
energyMeterSchema.index({ timestamp: -1 });
energyMeterSchema.index({ deviceId: 1, timestamp: -1 });

// Instance method to calculate apparent power
energyMeterSchema.methods.getApparentPower = function() {
  return this.power / Math.abs(this.powerFactor);
};

// Static method to get readings within a time range
energyMeterSchema.statics.getReadingsInRange = function(startDate, endDate, deviceId = null) {
  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (deviceId) {
    query.deviceId = deviceId;
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

// Create the model
const EnergyMeter = mongoose.model('EnergyMeter', energyMeterSchema);

// MongoDB connection status variable
let mongoConnectionStatus = "Disconnected";
let mongoError = null;

// Connect to MongoDB
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    mongoConnectionStatus = "Connected";
    mongoError = null;
    console.log("✅ Connected to MongoDB successfully!");
  } catch (error) {
    mongoConnectionStatus = "Failed";
    mongoError = error.message;
    console.error("❌ MongoDB connection failed:", error.message);
  }
};

// Monitor connection events
mongoose.connection.on("connected", () => {
  mongoConnectionStatus = "Connected";
  mongoError = null;
  console.log("✅ MongoDB connected");
});

mongoose.connection.on("disconnected", () => {
  mongoConnectionStatus = "Disconnected";
  console.log("⚠️ MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  mongoConnectionStatus = "Error";
  mongoError = error.message;
  console.error("❌ MongoDB error:", error.message);
});

// CORS configuration for wildcard access
app.use(cors({
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: false // Set to false when using wildcard origin
}));

app.use(express.json()); // Middleware to parse JSON requests

app.get("/", (req, res) => {
  const response = {
    message: "Welcome, your app is working well",
    mongodb: {
      status: mongoConnectionStatus,
      database: process.env.MONGODB_URI ? "Configured" : "Not Configured",
      timestamp: new Date().toISOString(),
    },
  };

  if (mongoError) {
    response.mongodb.error = mongoError;
  }

  res.status(200).json(response);
});

app.post("/", async (req, res) => {
  try {
    const { vol, current, power, energy, frequency, pf, deviceId, location } = req.body;
    
    console.log("📊 Received energy meter data:", req.body);
    
    // Since fields are not required, we can accept partial data
    // Create new energy meter reading with only provided values
    const energyData = {};
    
    if (vol !== undefined) energyData.voltage = vol;
    if (current !== undefined) energyData.current = current;
    if (power !== undefined) energyData.power = power;
    if (energy !== undefined) energyData.energy = energy;
    if (frequency !== undefined) energyData.frequency = frequency;
    if (pf !== undefined) energyData.powerFactor = pf;
    if (deviceId !== undefined) energyData.deviceId = deviceId;
    if (location !== undefined) energyData.location = location;
    
    // Create new energy meter reading
    const energyReading = new EnergyMeter(energyData);

    // Save to database
    const savedReading = await energyReading.save();
    
    console.log("✅ Energy meter data saved to database:", savedReading._id);
    
    const response = {
      message: "Energy meter data saved successfully",
      data: savedReading,
      insertedId: savedReading._id,
      timestamp: savedReading.timestamp
    };
    
    // Add apparent power calculation if power and powerFactor are available
    if (savedReading.power && savedReading.powerFactor) {
      response.apparentPower = savedReading.getApparentPower();
    }
    
    res.status(201).json(response);
    
  } catch (error) {
    console.error("❌ Error saving energy meter data:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: "Validation failed",
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error while saving data",
      details: error.message 
    });
  }
});

// GET endpoint to retrieve energy meter readings
app.get("/readings", async (req, res) => {
  try {
    const { deviceId, startDate, endDate, limit = 50 } = req.query;
    
    let query = {};
    
    if (deviceId) {
      query.deviceId = deviceId;
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const readings = await EnergyMeter.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.status(200).json({
      message: "Energy meter readings retrieved successfully",
      count: readings.length,
      data: readings
    });
    
  } catch (error) {
    console.error("Error retrieving energy meter data:", error);
    res.status(500).json({ 
      error: "Internal server error while retrieving data",
      details: error.message 
    });
  }
});

// Initialize MongoDB connection when server starts
connectMongoDB();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Export the Express API
module.exports = app;
