const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes'); 
const itemRoutes = require('./routes/itemRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
require('dotenv').config();
const app = express();

// Middleware
app.use(express.json());

// CORS configuration allowing any subdomain of straight-monitor.pages.dev
const corsOptions = {
  origin: function (origin, callback) {
    const allowedDomain = /https:\/\/straightmonitor\.com$/; // Only allow the main domain
    
    if (!origin || allowedDomain.test(origin)) {
      callback(null, true); // Allow the request
    } else {
      callback(new Error('Not allowed by CORS')); // Reject other origins
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,  // Allow credentials like cookies
};

//app.use(cors(corsOptions));  // Apply the CORS options
app.use(cors());
app.options('*', cors(corsOptions));

// Basic route
app.get('/', (req, res) => res.send('API Running'));

// Use the user-related routes
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);  // Exit process with failure
  });

// Start the server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));