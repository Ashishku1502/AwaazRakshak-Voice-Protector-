const express = require('express');
const router = express.Router();
const Shelter = require('../../database/models/Shelter');
const { getStatus } = require('../database/connection');

const mockShelters = [
    { name: "City Safety Center 1 (MOCK)", address: "123 High Street", contact: "911-001" },
    { name: "Underground Bunker Alpha (MOCK)", address: "456 Deep Cave Road", contact: "911-002" }
];

router.get('/near', async (req, res) => {
    try {
        if (!getStatus()) {
            return res.json(mockShelters);
        }
        const { lat, lng } = req.query;
        const shelters = await Shelter.find().limit(5);
        res.json(shelters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
