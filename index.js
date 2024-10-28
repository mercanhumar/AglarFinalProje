require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {

}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

// SSL/TLS Configuration
const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
};

// Import routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Start HTTPS server
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`Secure server running on https://localhost:${PORT}`);
});
