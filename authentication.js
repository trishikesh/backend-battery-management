const { MongoClient } = require('mongodb');
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors');

function startAuthServer(port, mongoUri) {
    const app = express();
    app.use(express.json());
    app.use(cors());

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

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'noreply.voltrack@gmail.com',
            pass: 'jycmanegeyorlzho'
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

    app.post('/update-user-details', async (req, res) => {
        const { userId, name, email, location, phoneNumber } = req.body;
        const userCollection = client.db("test").collection("User");

        try {
            const user = await userCollection.findOne({ userId });

            if (!user) {
                res.status(400).send('User not found');
            } else if (user.userType === 'new_user') {
                // Create new fields for new user and update values
                const updateFields = {};
                if (name) updateFields.name = name;
                if (email) updateFields.email = email;
                if (location) updateFields.location = location;
                if (phoneNumber) updateFields.phoneNumber = phoneNumber;
                updateFields.userType = 'existing_user';

                const result = await userCollection.updateOne(
                    { userId },
                    { $set: updateFields }
                );

                if (result.matchedCount === 1) {
                    res.send('User details added and userType changed to existing_user');
                } else {
                    res.status(500).send('Failed to update user details');
                }
            } else if (user.userType === 'existing_user') {
                // Update existing user fields with new values
                const updateFields = {};
                if (name) updateFields.name = name;
                if (email) updateFields.email = email;
                if (location) updateFields.location = location;
                if (phoneNumber) updateFields.phoneNumber = phoneNumber;

                const result = await userCollection.updateOne(
                    { userId },
                    { $set: updateFields }
                );

                if (result.matchedCount === 1) {
                    res.send('User details updated successfully');
                } else {
                    res.status(500).send('Failed to update user details');
                }
            } else {
                res.status(400).send('Invalid user type');
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

    app.listen(port, () => {
        console.log(`Authentication server is running on port ${port}`);
    });
}

module.exports = startAuthServer;
