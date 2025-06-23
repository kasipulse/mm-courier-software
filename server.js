const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const parcelRoutes = require('./routes/parcels'); // ✅ parcels routes
const authRoutes = require('./routes/auth');      // ✅ auth routes

dotenv.config();

const app = express(); // ✅ initialize app FIRST
app.use(cors());
app.use(express.json());

// ✅ Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ✅ API routes
app.use('/api/parcels', parcelRoutes);
app.use('/api/auth', authRoutes);  // <-- Add auth route hook here

// ✅ Health check
app.get('/', (req, res) => {
  res.send('📦 MM Courier API is live');
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
