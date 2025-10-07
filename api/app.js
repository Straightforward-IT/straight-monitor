const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const userRoutes = require('./routes/userRoutes'); 
const itemRoutes = require('./routes/itemRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const wpformsRoutes = require('./routes/wpformsRoutes');
const mitarbeiterRoutes = require('./routes/mitarbeiterRoutes');
const asanaRoutes = require('./routes/asanaRoutes');
const yousignRoutes = require('./routes/yousignRoutes');
const graphRoutes = require("./routes/graphRoutes");
const supportRoutes = require('./routes/supportRoutes');
const ErrorHandler = require('./middleware/ErrorHandler');
require('dotenv').config();
require('./serverRoutines');

const app = express();

// Middleware
const allowedDomains = ["http://localhost:5173", "https://straightmonitor.com",  "https://straight-monitor-684d4006140b.herokuapp.com", "https://flipcms.de/integration/flipcms/hpstraightforward"];
const allowedIPs = [
  '5.39.7.128', '5.39.7.129', '5.39.7.130', '5.39.7.131',
  '5.39.7.132', '5.39.7.133', '5.39.7.134', '5.39.7.135',
  '5.39.7.136', '5.39.7.137', '5.39.7.138', '5.39.7.139',
  '5.39.7.140', '5.39.7.141', '5.39.7.142', '5.39.7.143',
  '52.143.162.31', '51.103.81.166'
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log('Origin:', origin);
    if (!origin || allowedDomains.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};
function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) req.rawBody = buf.toString(encoding || 'utf8');
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(cors(corsOptions));  // Apply the CORS options
app.options('*', cors(corsOptions));
app.use(express.json({ verify: rawBodySaver }));

// Basic route
app.get('/', (req, res) => res.send('API Running'));

// Use the user-related routes
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/reports', wpformsRoutes);
app.use('/api/personal', mitarbeiterRoutes);
app.use('/api/asana', asanaRoutes);
app.use('/api/yousign', yousignRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/support', supportRoutes);
app.use((req, res, next) => {
  const headers = req.headers;
  res.send(headers);
});

app.use(ErrorHandler);
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
  mongoose.set("debug", false);

// Start the server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
