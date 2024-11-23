const startAuthServer = require('./authentication.js');
const startBatteryServer = require('./battery.js');

const mongoUri = "mongodb+srv://trial1:t1@trial-01.y8cbq.mongodb.net/";

startAuthServer(5000, mongoUri);
startBatteryServer(5001, mongoUri);