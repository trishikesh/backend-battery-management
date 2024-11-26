const { MongoClient } = require('mongodb');
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const mongoUri = "mongodb+srv://trial1:t1@trial-01.y8cbq.mongodb.net/";
const client = new MongoClient(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
    }
});

async function connectToMongo() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Connected to MongoDB");
    } catch (e) {
        console.error("MongoDB connection error:", e);
        // Instead of exiting, we'll keep the server running but log the error
        console.log("Server will continue running, but MongoDB features may not work");
    }
}

connectToMongo().catch(console.dir);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'noreply.voltrack@gmail.com',
        pass: 'jycmanegeyorlzho'
    }
});

app.post('/create-admin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const adminCollection = client.db("test").collection("admins");

        // Check if admin already exists
        const existingAdmin = await adminCollection.findOne({ email });
        if (existingAdmin) {
            return res.status(400).send('Admin already exists');
        }

        const admin = {
            email,
            password,
            createdAt: new Date()
        };

        const result = await adminCollection.insertOne(admin);
        if (result.acknowledged) {
            res.send({ message: 'Admin created successfully' });
        } else {
            res.status(500).send('Failed to create admin');
        }
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).send('Error occurred while creating admin');
    }
});

app.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const adminCollection = client.db("test").collection("admins");

        const admin = await adminCollection.findOne({ email, password });

        if (admin) {
            res.send({ message: 'Admin verified' });
        } else {
            res.status(401).send('Not an admin');
        }
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).send('Error occurred during admin login');
    }
});

app.post('/create-user', async (req, res) => {
    const { email, password } = req.body;
    const tempUserCollection = client.db("test").collection("tempUser");

    const tempUser = {
        email,
        password,
        createdAt: new Date()
    };

    await tempUserCollection.insertOne(tempUser);

    setTimeout(async () => {
        await tempUserCollection.deleteOne({ email });
    }, 24 * 60 * 60 * 1000); // 24 hours

    res.send('User created in temp collection');
});

app.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    const otp = crypto.randomInt(100000, 999999).toString();
    const tempUserCollection = client.db("test").collection("tempUser");

    await tempUserCollection.updateOne({ email }, { $set: { otp, otpCreatedAt: new Date() } });

    const mailOptions = {
        from: 'noreply.voltrack@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send(error.toString());
        }
        res.send('OTP sent');
    });
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const tempUserCollection = client.db("test").collection("tempUser");
    const userCollection = client.db("test").collection("User");

    const tempUser = await tempUserCollection.findOne({ email, otp });

    if (tempUser) {
        const currentTime = new Date();
        const otpCreatedAt = tempUser.otpCreatedAt;
        const otpExpiryTime = new Date(otpCreatedAt.getTime() + 120 * 1000); // 120 seconds

        if (currentTime <= otpExpiryTime) {
            const userId = crypto.randomBytes(5).toString('hex');
            const user = {
                email: tempUser.email,
                password: tempUser.password,
                userId,
                userType: 'new_user' 
            };

            await userCollection.insertOne(user);
            await tempUserCollection.deleteOne({ email });

            const mailOptions = {
                from: 'noreply.voltrack@gmail.com',
                to: email,
                subject: 'Welcome to the family',
                text: 'Welcome to the family'
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return res.status(500).send(error.toString());
                }
                res.send({ message: 'OTP verified and user created', userId });
            });
        } else {
            res.status(400).send('OTP expired');
        }
    } else {
        res.status(400).send('Invalid OTP');
    }
});

app.post('/fetch-user', async (req, res) => {
    const { email, password } = req.body;
    const userCollection = client.db("test").collection("User");

    const user = await userCollection.findOne({ email });

    if (!user) {
        res.status(400).send('Email error');
    } else if (user.password !== password) {
        res.status(400).send('Password error');
    } else {
        res.send({ message: 'Login allowed', userId: user.userId });
    }
});

app.get('/get-user-info', async (req, res) => {
    const { userId } = req.query;
    const userCollection = client.db("test").collection("User");

    const user = await userCollection.findOne({ userId });

    if (!user) {
        res.status(400).send('User not found');
    } else {
        if (user.userType === 'new_user') {
            res.send({ userType: 'new_user' });
        } else if (user.userType === 'existing_user') {
            res.send({ userType: 'existing_user', name: user.name });
        }else{
            res.status(400).send('User type not found');
        }
    }
});

app.patch('/update-user-details', async (req, res) => {
    const { userId, name, email, location, phoneNumber } = req.body;
    const userCollection = client.db("test").collection("User");

    try {
        const user = await userCollection.findOne({ userId });

        if (!user) {
            return res.status(404).send('User not registered');
        }

        // Compare and only update changed fields
        const updateFields = {};
        if (name && name !== user.name) updateFields.name = name;
        if (email && email !== user.email) updateFields.email = email;
        if (location && location !== user.location) updateFields.location = location;
        if (phoneNumber && phoneNumber !== user.phoneNumber) updateFields.phoneNumber = phoneNumber;

        // Set userType to existing_user if it's not already
        if (user.userType !== 'existing_user') {
            updateFields.userType = 'existing_user';
        }

        // Only update if there are changes
        if (Object.keys(updateFields).length > 0) {
            const result = await userCollection.updateOne(
                { userId },
                { $set: updateFields }
            );

            if (result.matchedCount === 1) {
                res.send({
                    message: 'User details updated successfully',
                    updatedFields: updateFields
                });
            } else {
                res.status(500).send('Failed to update user details');
            }
        } else {
            res.send({
                message: 'No changes detected',
                currentData: {
                    name: user.name,
                    email: user.email,
                    location: user.location,
                    phoneNumber: user.phoneNumber
                }
            });
        }

    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).send('Error occurred while updating user details');
    }
});

app.post('/jhingalala', async (req, res) => {
    const { userId } = req.body;
    const userCollection = client.db("test").collection("User");

    const user = await userCollection.findOne({ userId });

    if (!user) {
        res.status(400).send('User not found');
    } else {
        if (user.userType === 'new_user') {
            res.send({ userType: 'new_user' });
        } else if (user.userType === 'existing_user') {
            res.send({ 
                userType: 'existing_user', 
                name: user.name, 
                email: user.email, 
                phoneNumber: user.phoneNumber, 
                location: user.location 
            });
        } else {
            res.status(400).send('User type not found');
        }
    }
});

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
        // Generate random status and initial state of charge
        const status = Math.random() < 0.5 ? 'charged' : 'unplugged';
        let stateOfCharge = Math.floor(Math.random() * 100) + 1;

        // Adjust state of charge based on status
        if (status === 'charged') {
            stateOfCharge = Math.min(100, stateOfCharge + 1);
        } else {
            stateOfCharge = Math.max(1, stateOfCharge - 1);
        }

        // Generate random monthly state of charge data
        const monthlyData = [
            { month: 'Jan', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Feb', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Mar', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Apr', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'May', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Jun', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Jul', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Aug', avgCharge: Math.floor(Math.random() * 100) + 1 },
            { month: 'Sep', avgCharge: Math.floor(Math.random() * 100) + 1 }
        ];

        const batteryDetails = {
            userId,
            activationDate,
            batteryName,
            batteryType, 
            expectedEndDate,
            manufacturer,
            status,
            stateOfCharge,
            monthlyChargeData: monthlyData,
            createdAt: new Date()
        };

        const result = await batteryCollection.insertOne(batteryDetails);

        if (result.acknowledged) {
            // Set up hourly status updates
            setInterval(async () => {
                const newStatus = Math.random() < 0.5 ? 'charged' : 'unplugged';
                let newStateOfCharge = stateOfCharge;

                if (newStatus === 'charged') {
                    newStateOfCharge = Math.min(100, newStateOfCharge + 1);
                } else {
                    newStateOfCharge = Math.max(1, newStateOfCharge - 1);
                }

                await batteryCollection.updateOne(
                    { userId },
                    { 
                        $set: { 
                            status: newStatus,
                            stateOfCharge: newStateOfCharge,
                            lastUpdated: new Date()
                        }
                    }
                );
            }, 60 * 60 * 1000); // Update every hour

            res.send({ message: 'Battery details saved successfully' });
        } else {
            res.status(500).send('Failed to save battery details');
        }

    } catch (error) {
        console.error('Error saving battery details:', error);
        res.status(500).send('Error occurred while saving battery details');
    }
});

app.post('/fetch-battery', async (req, res) => {
    try {
        const { userId } = req.body;
        const batteryCollection = client.db("test").collection("batteryData");

        const batteries = await batteryCollection.find({ userId }).toArray();

        if (batteries.length > 0) {
            res.send(batteries);
        } else {
            res.status(404).send({ message: 'No batteries found for this user' });
        }

    } catch (error) {
        console.error('Error fetching battery details:', error);
        res.status(500).send('Error occurred while fetching battery details');
    }
});

app.get('/battery/:batteryId', async (req, res) => {
    try {
        const { batteryId } = req.params;
        const batteryCollection = client.db("test").collection("batteryData");

        const battery = await batteryCollection.findOne({ _id: new MongoClient.ObjectId(batteryId) });

        if (battery) {
            res.send(battery);
        } else {
            res.status(404).send({ message: 'Battery not found' });
        }

    } catch (error) {
        console.error('Error fetching individual battery details:', error);
        res.status(500).send('Error occurred while fetching battery details');
    }
});

app.post('/lodge-complaint', async (req, res) => {
    try {
        const { userId, batteryName, date, level, description } = req.body;
        const complaintsCollection = client.db("test").collection("Complaints");

        // Format the date as dd-mm-yyyy
        const formattedDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '-');

        // Generate a unique complaint number
        let isUnique = false;
        let complaintNumber;
        
        while (!isUnique) {
            // Generate random 5 digit number
            const randomNum = Math.floor(10000 + Math.random() * 90000);
            complaintNumber = `COM${randomNum}`;
            
            // Check if this complaint number already exists
            const existingComplaint = await complaintsCollection.findOne({ complaintNumber });
            if (!existingComplaint) {
                isUnique = true;
            }
        }

        const complaint = {
            userId,
            batteryName,
            date,
            level,
            description,
            status: 'Pending',
            createdAt: formattedDate,
            complaintNumber
        };

        const result = await complaintsCollection.insertOne(complaint);

        if (result.acknowledged) {
            res.send({ 
                message: 'Complaint lodged successfully',
                complaintNumber: complaintNumber 
            });
        } else {
            res.status(500).send('Failed to lodge complaint');
        }

    } catch (error) {
        console.error('Error lodging complaint:', error);
        res.status(500).send('Error occurred while lodging complaint');
    }
});

app.post('/get-lodge-complaint', async (req, res) => {
    try {
        const { userId } = req.body;
        const complaintsCollection = client.db("test").collection("Complaints");

        const complaints = await complaintsCollection.find({ userId: userId }).toArray();

        if (complaints.length > 0) {
            res.send(complaints);
        } else {
            res.status(404).send({ message: 'No complaints found for this user' });
        }

    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).send('Error occurred while fetching complaints');
    }
});

app.get('/all-complaints', async (req, res) => {
    try {
        const complaintsCollection = client.db("test").collection("Complaints");
        
        const complaints = await complaintsCollection.find({}).toArray();

        if (complaints.length > 0) {
            res.send(complaints);
        } else {
            res.status(404).send({ message: 'No complaints found' });
        }

    } catch (error) {
        console.error('Error fetching all complaints:', error);
        res.status(500).send('Error occurred while fetching complaints');
    }
});

app.put('/update-status', async (req, res) => {
    try {
        const { complaintNumber, newStatus } = req.body;
        const complaintsCollection = client.db("test").collection("Complaints");

        // Add validation to ensure newStatus is not null/undefined
        if (!newStatus) {
            return res.status(400).send({ message: 'New status is required' });
        }

        // Log the values to help debug
        console.log('Updating complaint:', { complaintNumber, newStatus });

        const result = await complaintsCollection.updateOne(
            { complaintNumber: complaintNumber },
            { $set: { status: newStatus } }
        );

        if (result.matchedCount > 0) {
            res.send({ 
                message: 'Complaint status updated successfully',
                updatedStatus: newStatus 
            });
        } else {
            res.status(404).send({ message: 'Complaint not found' });
        }

    } catch (error) {
        console.error('Error updating complaint status:', error);
        res.status(500).send('Error occurred while updating complaint status');
    }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Authentication server is running on port ${PORT}`);
});
