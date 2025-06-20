const express = require('express');
const router = express.Router();
const supabase = require('../db');

// Simple test route
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('parcels').select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

module.exports = router;
