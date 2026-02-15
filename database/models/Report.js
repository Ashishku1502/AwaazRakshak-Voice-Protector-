const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    type: { type: String, required: true }, // e.g., "blocked_road"
    location: {
        lat: Number,
        lng: Number
    },
    reportedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', ReportSchema);
