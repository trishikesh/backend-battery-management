const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Use the centralized MongoDB URI
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToMongo() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (e) {
        console.error(e);
    }
}

connectToMongo();

// Helper function to generate random state of charge value
function getRandomStateOfCharge() {
    return Math.floor(Math.random() * 101); // 0 to 100
}

// Helper function to generate random monthly data
function generateRandomMonthlyData() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    return months.map(month => ({
        month,
        avgStateOfCharge: Math.floor(Math.random() * 101)
    }));
}

app.post('/set-battery', async (req, res) => {
    const { userId, "Battery Name": batteryName, "Battery Type": batteryType, 
            Manufacturer, "Activation Date": activationDate, 
            "Expected End Date": expectedEndDate } = req.body;
    
    const batteryCollection = client.db("test").collection("batteries");
    
    const initialStatus = Math.random() < 0.5 ? 'charging' : 'unplugged';
    const initialStateOfCharge = getRandomStateOfCharge();
    
    const batteryData = {
        userId,
        batteryName,
        batteryType,
        manufacturer: Manufacturer,
        activationDate,
        expectedEndDate,
        status: initialStatus,
        stateOfCharge: initialStateOfCharge,
        values: generateRandomMonthlyData()
    };

    try {
        await batteryCollection.insertOne(batteryData);
        
        // Set up interval to update state of charge
        setInterval(async () => {
            const battery = await batteryCollection.findOne({ userId, batteryName });
            if (battery) {
                let newStateOfCharge = battery.stateOfCharge;
                
                if (battery.status === 'charging' && newStateOfCharge < 100) {
                    newStateOfCharge = Math.min(100, newStateOfCharge + 1);
                } else if (battery.status === 'unplugged' && newStateOfCharge > 0) {
                    newStateOfCharge = Math.max(0, newStateOfCharge - 1);
                }
                
                await batteryCollection.updateOne(
                    { userId, batteryName },
                    { $set: { stateOfCharge: newStateOfCharge } }
                );
            }
        }, 60000); // Update every minute
        
        res.send('Battery data saved successfully');
    } catch (error) {
        console.error('Error saving battery data:', error);
        res.status(500).send('Error occurred while saving battery data');
    }
});

app.get('/fetch-battery', async (req, res) => {
    const { userId } = req.query;
    const batteryCollection = client.db("test").collection("batteries");

    try {
        const batteries = await batteryCollection.find({ userId }).toArray();
        if (batteries.length === 0) {
            res.status(404).send('No batteries found for this user');
        } else {
            res.send(batteries);
        }
    } catch (error) {
        console.error('Error fetching batteries:', error);
        res.status(500).send('Error occurred while fetching batteries');
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Battery server is running on port ${process.env.PORT}`);
});
