const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Missing username or password' });
  }

  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, data.password);

  if (!match) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  res.json({
    success: true,
    message: 'Login successful',
    driver: {
      uuid: data.uuid,
      name: data.driver_name,
      route: data.route_number
    }
  });
});

module.exports = router;
