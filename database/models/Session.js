const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  disasterType: { type: String, enum: ['flood', 'earthquake', null], default: null },
  urgencyLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  emotionalState: { type: String, default: 'calm' },
  currentStep: { type: Number, default: 0 },
  location: {
    lat: Number,
    lng: Number
  },
  environmentFlags: {
    waterLevel: { type: String, default: null },
    shaking: { type: Boolean, default: false },
    gasSmell: { type: Boolean, default: false },
    injuryDetected: { type: Boolean, default: false }
  },
  firstAidGiven: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model('Session', SessionSchema);
