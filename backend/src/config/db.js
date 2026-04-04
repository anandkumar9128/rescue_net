const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic
 * Falls back gracefully if connection fails
 */
const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries}/${maxRetries} failed: ${error.message}`);

      if (retries < maxRetries) {
        console.log(`⏳ Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error('💀 All MongoDB connection attempts failed. Running in degraded mode.');
        // Don't crash — SMS fallback and offline queue will handle requests
      }
    }
  }
};

module.exports = connectDB;
