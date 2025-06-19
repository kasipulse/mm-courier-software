// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fedexRoutes = require('./routes/fedex');
const podRoutes = require('./routes/pod');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/fedex', fedexRoutes);
app.use('/api/pod', podRoutes);

app.get('/', (req, res) => {
  res.send('MM Courier backend is live 🚛');
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
