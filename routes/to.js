// 🔐 DRIVER LOGIN: /api/auth/login
router.post('/api/auth/login', async (req, res) => {
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
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  // ✅ TEMPORARY PLAIN-TEXT PASSWORD CHECK
  if (password !== data.password) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  res.json({
    success: true,
    message: 'Login successful',
    driver: {
      id: data.uuid,
      name: data.driver_name,
      route: data.route_number
    }
  });
});
