const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🔁 GET all parcels (for dashboard or reporting)
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
      .update({
        status: 'Received',
        received_date: new Date().toISOString()
      })
      .eq('tracking_number', tracking_number)
      .eq('status', 'Pending') // Only update if still pending
      .single();

    if (error || !data) throw error || new Error('Parcel not found or already received');
    res.json({ success: true, message: 'Parcel scanned in successfully.' });
  } catch (err) {
    console.error('Scan-in error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ✅ SCAN OUT route — assign to driver and mark scanned out
router.put('/:tracking_number/scanout', async (req, res) => {
  const { tracking_number } = req.params;
  const { driver_name } = req.body;

  try {
    const { data, error } = await supabase
      .from('parcels')
      .update({
        status: 'Scanned Out',
        driver_name,
        scanned_out_at: new Date().toISOString()
      })
      .eq('tracking_number', tracking_number)
      .eq('status', 'Received') // Only scan out parcels already received
      .single();

    if (error || !data) throw error || new Error('Parcel not found or already scanned out');
    res.json({ success: true, message: 'Parcel assigned to driver successfully.' });
  } catch (err) {
    console.error('Scan-out error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
