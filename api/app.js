const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const userRoutes = require('./routes/userRoutes'); 
const itemRoutes = require('./routes/itemRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
require('dotenv').config();
const app = express();

// Middleware
app.use(express.json());

const allowedDomains = ["http://localhost:5173", "https://straightmonitor.com"];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('Origin:', origin);
    if (!origin || allowedDomains.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));  // Apply the CORS options

// Basic route
app.get('/', (req, res) => res.send('API Running'));

// Use the user-related routes
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Function to get and log the public IP
async function logCurrentIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    console.log('Current server IP:', response.data.ip);
  } catch (error) {
    console.error('Error fetching IP address:', error);
  }
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(async (err) => {
    console.error('MongoDB connection error:', err);
    await logCurrentIP();
    process.exit(1);  // Exit process with failure
  });

// Start the server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
