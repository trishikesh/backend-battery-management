const { fork } = require('child_process');

// Centralize the MongoDB connection string
const mongoUri = "mongodb+srv://trial1:t1@trial-01.y8cbq.mongodb.net/";

// Fork the authentication server with the MongoDB URI
const authServer = fork('./authentication.js', [], { env: { MONGO_URI: mongoUri, PORT: 5000 } });

// Fork the battery server with the MongoDB URI
const batteryServer = fork('./battery.js', [], { env: { MONGO_URI: mongoUri, PORT: 5001 } });

// Handle any errors from the child processes
authServer.on('error', (err) => {
    console.error('Error in authentication server:', err);
});

batteryServer.on('error', (err) => {
    console.error('Error in battery server:', err);
});