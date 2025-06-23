const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🔁 GET all parcels
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parcels')
      .select('*')
      .order('received_date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching parcels:', err.message);
    res.status(500).json({ error: 'Failed to fetch parcels' });
  }
});

// ✅ SCAN IN route — mark parcel as received
router.put('/scanin/:tracking_number', async (req, res) => {
  const { tracking_number } = req.params;

  try {
    const { data, error } = await supabase
      .from('parcels')
      .update({ status: 'Received' })
      .eq('tracking_number', tracking_number)
      .eq('status', 'Pending') // only update if still pending
      .single();

    if (error || !data) throw error || new Error('Parcel not found or already received');
    res.json({ success: true, message: 'Parcel scanned in successfully.' });
  } catch (err) {
    console.error('Scan-in error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ✅ SCAN OUT route — mark parcel as scanned out
router.put('/:id/scanout', async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('parcels')
      .update({ status: 'Scanned Out' })
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Parcel scanned out successfully.' });
  } catch (err) {
    console.error('Scan-out error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to scan out parcel.' });
  }
});

module.exports = router;
