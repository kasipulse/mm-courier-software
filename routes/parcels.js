// routes/parcels.js

const express = require('express');
const router = express.Router();
const supabase = require('../db');

// GET all parcels
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('parcels').select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

module.exports = router;
