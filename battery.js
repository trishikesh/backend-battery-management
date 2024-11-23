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
    app.post('/set-battery', async (req, res) => {
        const { 
            userId,
            activationDate,
            batteryName, 
            batteryType,
            expectedEndDate,
            manufacturer
        } = req.body;

        const batteryCollection = client.db("test").collection("batteryData");

        try {
            const batteryDetails = {
                userId,
                activationDate,
                batteryName,
                batteryType, 
                expectedEndDate,
                manufacturer,
                createdAt: new Date()
            };

            const result = await batteryCollection.insertOne(batteryDetails);

            if (result.acknowledged) {
                res.send({ message: 'Battery details saved successfully' });
            } else {
                res.status(500).send('Failed to save battery details');
            }

        } catch (error) {
            console.error('Error saving battery details:', error);
            res.status(500).send('Error occurred while saving battery details');
        }
    });

    app.listen(port, () => {
        console.log(`Battery server is running on port ${port}`);
    });
}

module.exports = startBatteryServer;