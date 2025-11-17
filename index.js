// index.js
const express = require('express')
const mongoose = require('mongoose')
require('dotenv').config()

const app = express()
const PORT = 4000

// MongoDB connection status variable
let mongoConnectionStatus = 'Disconnected'
let mongoError = null

// Connect to MongoDB
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    mongoConnectionStatus = 'Connected'
    mongoError = null
    console.log('✅ Connected to MongoDB successfully!')
  } catch (error) {
    mongoConnectionStatus = 'Failed'
    mongoError = error.message
    console.error('❌ MongoDB connection failed:', error.message)
  }
}

// Monitor connection events
mongoose.connection.on('connected', () => {
  mongoConnectionStatus = 'Connected'
  mongoError = null
  console.log('✅ MongoDB connected')
})

mongoose.connection.on('disconnected', () => {
  mongoConnectionStatus = 'Disconnected'
  console.log('⚠️ MongoDB disconnected')
})

mongoose.connection.on('error', (error) => {
  mongoConnectionStatus = 'Error'
  mongoError = error.message
  console.error('❌ MongoDB error:', error.message)
})


app.get('/', (req, res) => {
  const response = {
    message: 'Welcome, your app is working well',
    mongodb: {
      status: mongoConnectionStatus,
      database: process.env.MONGODB_URI ? 'Configured' : 'Not Configured',
      timestamp: new Date().toISOString()
    }
  }
  
  if (mongoError) {
    response.mongodb.error = mongoError
  }
  
  res.status(200).json(response)
})


// Initialize MongoDB connection when server starts
connectMongoDB()

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Export the Express API
module.exports = app