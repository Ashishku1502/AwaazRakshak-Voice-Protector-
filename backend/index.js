require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const voiceHandler = require('./sockets/voiceHandler');
const shelterRoutes = require('./routes/shelter');

// Register Routes
app.use('/api/shelters', shelterRoutes);

const { connectDB } = require('./database/connection');

// MongoDB Connection
connectDB();

// Initialize Socket Handlers
voiceHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
