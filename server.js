const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

const parcelRoutes = require('./routes/parcels');       // ✅ parcels routes
const authRoutes = require('./routes/auth');            // ✅ auth routes
const driversRoutes = require('./routes/drivers');      // ✅ drivers routes
const integrationRoutes = require('./routes/integration'); // ✅ ParcelPerfect JSON API hook
const toRoutes = require('./routes/to');                // ✅ new "to" route

dotenv.config();

const app = express(); // ✅ initialize app FIRST
app.use(cors());
app.use(express.json());

// ✅ Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ✅ API routes
app.use('/api/parcels', parcelRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api/to', toRoutes); // ✅ hook added

// ✅ Health check
app.get('/', (req, res) => {
  res.send('📦 MM Courier API is live');
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
