const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// GET all drivers
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching drivers:', err.message);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// GET single driver by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw error || new Error('Driver not found');
    res.json(data);
  } catch (err) {
    console.error('Error fetching driver:', err.message);
    res.status(404).json({ error: err.message });
  }
});

// POST add new driver
router.post('/', async (req, res) => {
  const { name, route_number } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Driver name is required' });
  }

  try {
    const { data, error } = await supabase
      .from('drivers')
      .insert([{ name, route_number }])
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Driver added', driver: data });
  } catch (err) {
    console.error('Error adding driver:', err.message);
    res.status(500).json({ error: 'Failed to add driver' });
  }
});

// PUT update driver by ID
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, route_number } = req.body;

  try {
    const { data, error } = await supabase
      .from('drivers')
      .update({ name, route_number })
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ message: 'Driver updated', driver: data });
  } catch (err) {
    console.error('Error updating driver:', err.message);
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

// DELETE driver by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Driver deleted' });
  } catch (err) {
    console.error('Error deleting driver:', err.message);
    res.status(500).json({ error: 'Failed to delete driver' });
  }
});

module.exports = router;
