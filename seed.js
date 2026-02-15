const mongoose = require('mongoose');
const Shelter = require('./database/models/Shelter');
require('dotenv').config({ path: './backend/.env' });

const shelters = [
    {
        name: "City Safety Center 1",
        address: "123 High Street, North Hill",
        coordinates: { lat: 12.9716, lng: 77.5946 },
        capacity: 500,
        contact: "911-001"
    },
    {
        name: "Underground Bunker Alpha",
        address: "456 Deep Cave Road",
        coordinates: { lat: 12.9816, lng: 77.6046 },
        capacity: 200,
        contact: "911-002"
    }
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/awaazrakshak');
    console.log("Connected to MongoDB");

    await Shelter.deleteMany({});
    await Shelter.insertMany(shelters);

    console.log("Seed data inserted successfully");
    mongoose.connection.close();
}

seed().catch(err => console.error(err));
