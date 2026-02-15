const mongoose = require('mongoose');

const ShelterSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: {
        lat: Number,
        lng: Number
    },
    capacity: { type: Number },
    contact: { type: String }
});

module.exports = mongoose.model('Shelter', ShelterSchema);
