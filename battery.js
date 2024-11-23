const { MongoClient } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS with specific options
app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'], // Allow both GET and POST methods
    allowedHeaders: ['Content-Type'] // Allow Content-Type header
}));

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

// Explicitly define route with full path
app.post('/set-battery', async (req, res) => {
    console.log('Received POST request to /set-battery');
    console.log('Request body:', req.body);

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
        
        res.status(200).json({ message: 'Battery data saved successfully' });
    } catch (error) {
        console.error('Error saving battery data:', error);
        res.status(500).json({ error: 'Error occurred while saving battery data' });
    }
});

app.get('/fetch-battery', async (req, res) => {
    const { userId } = req.query;
    const batteryCollection = client.db("test").collection("batteries");

    try {
        const batteries = await batteryCollection.find({ userId }).toArray();
        if (batteries.length === 0) {
            res.status(404).json({ error: 'No batteries found for this user' });
        } else {
            res.status(200).json(batteries);
        }
    } catch (error) {
        console.error('Error fetching batteries:', error);
        res.status(500).json({ error: 'Error occurred while fetching batteries' });
    }
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Add 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

const port = process.env.PORT || 5001;
app.listen(port, () => {
    console.log(`Battery server is running on port ${port}`);
});
