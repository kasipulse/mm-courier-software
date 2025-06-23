const path = require('path');

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const parcelRoutes = require('./routes/parcels'); // ✅ this line

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ✅ connect parcels API
app.use('/api/parcels', parcelRoutes); // ✅ this line

// health check
app.get('/', (req, res) => {
  res.send('📦 MM Courier API is live');
});

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
