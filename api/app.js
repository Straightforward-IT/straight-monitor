const path = require('path');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const userRoutes = require('./routes/auth/userRoutes'); 
const itemRoutes = require('./routes/deprecated/itemRoutes');
const monitoringRoutes = require('./routes/system/monitoringRoutes');
const locationRoutes = require('./routes/system/locationRoutes');
const paketVorlageRoutes = require('./routes/system/paketVorlageRoutes');
const inventoryRoutes = require('./routes/system/inventoryRoutes');
const wpformsRoutes = require('./routes/system/wpformsRoutes');
const mitarbeiterRoutes = require('./routes/employee/mitarbeiterRoutes');
const asanaRoutes = require('./routes/integrations/asanaRoutes');
const docusealRoutes = require('./routes/signature/docusealRoutes');
const graphRoutes = require("./routes/integrations/graphRoutes");
const supportRoutes = require('./routes/system/supportRoutes');
const zvooveRoutes = require('./routes/integrations/zvooveRoutes');
const dataImportRoutes = require('./routes/system/dataImportRoutes');
const auftraegeRoutes = require('./routes/events/auftraegeRoutes');
const kundenRoutes = require('./routes/customer/kundenRoutes');
const publicCapacityRoutes = require('./routes/public/publicCapacityRoutes');
const publicPrototypeRoutes = require('./routes/public/publicPrototypeRoutes');
const publicRoutes = require('./routes/public/publicRoutes');
const publicBewerberRoutes = require('./routes/public/publicBewerberRoutes');
const publicWorkingTimeRoutes = require('./routes/public/publicWorkingTimeRoutes');
const oidcRoutes = require('./routes/auth/oidcRoutes');
const flipTaskRoutes = require('./routes/integrations/flipTaskRoutes');
const flipUserFixRoutes = require('./routes/integrations/flipUserFixRoutes');
const flipFileRoutes = require('./routes/integrations/flipFileRoutes');
const flipCalendarRoutes = require('./routes/integrations/flipCalendarRoutes');
const flipPageRoutes = require('./routes/integrations/flipPageRoutes');
const pdfTemplateRoutes = require('./routes/deprecated/pdfTemplateRoutes');
const pdfVorgangRoutes = require('./routes/deprecated/pdfVorgangRoutes');
const signaturRoutes = require('./routes/signature/signaturRoutes');
const signaturTypRoutes = require('./routes/signature/signaturTypRoutes');
const reisekostenRoutes = require('./routes/signature/reisekostenRoutes');
const dispoRoutes = require('./routes/employee/dispoRoutes');
const dispoKommentarRoutes = require('./routes/employee/dispoKommentarRoutes');
const commentRoutes = require('./routes/system/commentRoutes');
const leadRoutes = require('./routes/customer/leadRoutes');
const bewerberRoutes = require('./routes/employee/bewerberRoutes');
const bewerberManagementRoutes = require('./routes/employee/bewerberManagementRoutes');
const employeeEmailTemplateRoutes = require('./routes/employee/employeeEmailTemplateRoutes');
const eRechnungRoutes = require('./routes/finance/eRechnungRoutes');
const ErrorHandler = require('./middleware/ErrorHandler');
const logger = require('./utils/logger');
require('dotenv').config();
require('./serverRoutines');

const app = express();

// Middleware
const allowedDomains = ["http://localhost:5173", "https://straightmonitor.com",  "https://straight-monitor-684d4006140b.herokuapp.com", "https://flipcms.de/integration/flipcms/hpstraightforward", "https://api.docuseal.eu", "https://app.docuseal.eu"];
const allowedIPs = [
  '5.39.7.128', '5.39.7.129', '5.39.7.130', '5.39.7.131',
  '5.39.7.132', '5.39.7.133', '5.39.7.134', '5.39.7.135',
  '5.39.7.136', '5.39.7.137', '5.39.7.138', '5.39.7.139',
  '5.39.7.140', '5.39.7.141', '5.39.7.142', '5.39.7.143',
  '52.143.162.31', '51.103.81.166'
];

const corsOptions = {
  origin: function (origin, callback) {
    logger.debug('CORS Origin:', origin);
    // Check if origin is in allowed domains or matches dev domain pattern
    const isAllowed = !origin || 
      allowedDomains.includes(origin) || 
      /^https:\/\/[a-z0-9]+\.straightmonitor\.pages\.dev$/.test(origin);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};
function rawBodySaver(req, res, buf, encoding) {
  if (buf && buf.length) req.rawBody = buf.toString(encoding || 'utf8');
}

// Normalize double (or more) slashes in URL paths early, before routing
app.use((req, _res, next) => {
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(cors(corsOptions));  // Apply the CORS options
app.options('*', cors(corsOptions));
app.use(express.json({ verify: rawBodySaver }));

// Use the user-related routes
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/paket-vorlagen', paketVorlageRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', wpformsRoutes);
app.use('/api/personal', mitarbeiterRoutes);
app.use('/api/asana', asanaRoutes);
app.use('/api/docuseal', docusealRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/zvoove', zvooveRoutes);
app.use('/api/import', dataImportRoutes);
app.use('/api/auftraege', auftraegeRoutes);
app.use('/api/kunden', kundenRoutes);
app.use('/api/public/capacity', publicCapacityRoutes);
app.use('/api/public/bewerber', publicBewerberRoutes);
app.use('/api/public/prototype', publicPrototypeRoutes);
app.use('/api/public/payroll-time', publicWorkingTimeRoutes);
app.use('/api/public', publicRoutes);
// OIDC routes are mounted separately — NOT under /api/public which requires publicAuth
app.use('/api/oidc', oidcRoutes);
app.use('/api/flip-tasks', flipTaskRoutes);
app.use('/api/flip-user-fix', flipUserFixRoutes);
app.use('/api/flip-files', flipFileRoutes);
app.use('/api/flip-calendar', flipCalendarRoutes);
app.use('/api/flip-pages', flipPageRoutes);
app.use('/api/pdf-templates', pdfTemplateRoutes);
app.use('/api/pdf-vorgaenge', pdfVorgangRoutes);
app.use('/api/signaturen', signaturRoutes);
app.use('/api/signatur-typen', signaturTypRoutes);
app.use('/api/reisekosten', reisekostenRoutes);
app.use('/api/dispo', dispoRoutes);
app.use('/api/dispo-kommentare', dispoKommentarRoutes); // legacy — kept for backwards compat
app.use('/api/comments', commentRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/bewerber/admin', bewerberManagementRoutes);
app.use('/api/employee-email-templates', employeeEmailTemplateRoutes);
app.use('/api/e-rechnungen', eRechnungRoutes);
app.use('/api/bewerber', bewerberRoutes);

// Debug endpoint (moved to specific path instead of catch-all)
app.get('/api/debug/headers', (req, res) => {
  res.json({ headers: req.headers, ip: req.ip, method: req.method, url: req.url });
});

// Serve Vue SPA static files in production
const distPath = path.join(__dirname, '../frontend/Straight-Monitor/dist');
app.use(express.static(distPath));

// SPA fallback: serve index.html for any non-API GET request
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ success: false, message: 'Not found' });
    }
  });
});

// 404 handler for unmatched non-GET routes (POST, PUT, etc.)
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use(ErrorHandler);
// Function to get and log the public IP
async function logCurrentIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    logger.info('Current server IP:', response.data.ip);
  } catch (error) {
    logger.error('Error fetching IP address:', error);
  }
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    logger.dbConnect();
    // ─── Roles Migration (idempotent) ────────────────────────────────────────
    // Migrate users that still have an empty `roles` array by deriving it from the legacy `role` field.
    const User = require('./models/System/User');
    const unmigrated = await User.find({ $or: [{ roles: { $exists: false } }, { roles: { $size: 0 } }] });
    if (unmigrated.length > 0) {
      logger.info(`Roles migration: migrating ${unmigrated.length} user(s)...`);
      for (const u of unmigrated) {
        u.roles = [u.role === 'ADMIN' ? 'ADMIN' : 'USER'];
        await u.save();
      }
      logger.info('Roles migration complete.');
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Verify R2 connection on startup
    const R2Service = require('./services/integrations/R2Service');
    await R2Service.testConnection();
  })
  .catch(async (err) => {
    logger.dbError(err);
    await logCurrentIP();
    process.exit(1);  // Exit process with failure
  });
  mongoose.set("debug", false);

// Start the server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => logger.serverStart(PORT));
