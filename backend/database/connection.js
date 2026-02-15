const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/awaazrakshak';
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000 // 5 seconds timeout
        });
        isConnected = true;
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        isConnected = false;
        console.error('❌ MongoDB connection failed. Switching to IN-MEMORY fallback.');
        console.error('Check if MongoDB service is running.');
    }
};

const getStatus = () => isConnected;

module.exports = { connectDB, getStatus };
