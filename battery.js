const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors');

function startBatteryServer(port, mongoUri) {
    const app = express();
    app.use(cors({
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type']
    }));
    app.use(express.json());

    const client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

    async function connectToMongo() {
        try {
            await client.connect();
            console.log("Connected to MongoDB");
        } catch (e) {
            console.error(e);
        }
    }

    connectToMongo();

    // Define routes here (e.g., app.post('/set-battery', ...))

    app.listen(port, () => {
        console.log(`Battery server is running on port ${port}`);
    });
}

module.exports = startBatteryServer;
