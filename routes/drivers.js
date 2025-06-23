const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware or simple check for basic auth (OPTIONAL)
// For now, no protection, but you can add middleware later

router.post('/add', async (req, res) => {
  const { name, username, password } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase.from('drivers').insert([
      {
        name,
        username,
        password: hashedPassword
      }
    ]);

    if (error) throw error;

    res.json({ success: true, message: 'Driver added successfully.', driver: data[0] });
  } catch (err) {
    console.error('Add driver error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
