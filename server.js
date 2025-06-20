const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const fedexRoutes = require('./routes/fedex');
const parcelRoutes = require('./routes/parcels');

dotenv.config();

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// ✅ Serve Static Files from /public (HTML, JS, CSS)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ API Routes
app.use('/api/fedex', fedexRoutes);
app.use('/api/parcels', parcelRoutes);

// ✅ Health check (basic root route)
app.get('/', (req, res) => {
  res.send('📦 MM Courier API is running');
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ MM Courier server running on port ${PORT}`);
});

