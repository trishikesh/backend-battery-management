const { MongoClient } = require('mongodb');
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors'); // Import the cors module

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes

const uri = "mongodb+srv://trial1:t1@trial-01.y8cbq.mongodb.net/";
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

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'noreply.voltrack@gmail.com',
        pass: 'jycmanegeyorlzho' // replace with your actual password
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
                userId
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
                res.send('OTP verified and user created');
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
        res.send('Login allowed');
    }
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
