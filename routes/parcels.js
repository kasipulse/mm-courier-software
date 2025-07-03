const express = require('express');
const router = express.Router();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const axios = require('axios');
require('dotenv').config();

// Supabase connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: 'uploads/' }); // for MDE + POD

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

// ✅ SCAN IN — mark parcel as received
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
      .eq('status', 'Pending')
      .single();

    if (error || !data) throw error || new Error('Parcel not found or already received');
    res.json({ success: true, message: 'Parcel scanned in successfully.' });
  } catch (err) {
    console.error('Scan-in error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ✅ SCAN OUT — assign to driver and mark scanned out
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
      .eq('status', 'Received')
      .single();

    if (error || !data) throw error || new Error('Parcel not found or already scanned out');
    res.json({ success: true, message: 'Parcel assigned to driver successfully.' });
  } catch (err) {
    console.error('Scan-out error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ✅ POD Upload — optional GRV number
router.post('/pod', upload.single('image'), async (req, res) => {
  const { tracking_number, received_by, delivered_at_time, grv_number } = req.body;
  const file = req.file;

  if (!file || !tracking_number || !received_by || !delivered_at_time) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'pod_images' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    const uploadResult = await streamUpload(file.buffer);

    const { data, error } = await supabase
      .from('parcels')
      .update({
        status: 'Delivered',
        pod_url: uploadResult.secure_url,
        received_by,
        delivered_at: new Date().toISOString(),
        delivered_at_time,
        grv_number: grv_number || null
      })
      .eq('tracking_number', tracking_number)
      .eq('status', 'Scanned Out')
      .single();

    if (error || !data) throw error || new Error('Parcel not found or not eligible for POD.');

    const ppPayload = {
      Username: process.env.PP_USERNAME,
      Password: process.env.PP_PASSWORD,
      Request: 'AddProofOfDelivery',
      WaybillNumber: data.waybill_number,
      DeliveredBy: received_by,
      DeliveryDate: new Date().toISOString().split('T')[0],
      PODUrl: uploadResult.secure_url
    };

    try {
      await axios.post(process.env.PP_ENDPOINT, ppPayload);
      console.log('✅ POD sent to ParcelPerfect successfully.');
    } catch (ppError) {
      console.warn('⚠️ Failed to send POD to ParcelPerfect:', ppError.message);
    }

    res.json({ success: true, message: 'POD uploaded and updated.', pod_url: uploadResult.secure_url });
  } catch (err) {
    console.error('POD upload error:', err.message);
    res.status(500).json({ success: false, message: 'Upload failed. ' + err.message });
  }
});

// ✅ MDE Upload
router.post('/mde-upload', upload.single('mdeFile'), async (req, res) => {
  const filePath = req.file.path;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');

    let processed = 0;

    for (const line of lines) {
      if (line.trim().length < 12) continue;

      const trackingNumber = line.substring(0, 12).trim();

      if (trackingNumber) {
        const { data, error } = await supabase
          .from('parcels')
          .update({ status: 'Received from FedEx' })
          .eq('tracking_number', trackingNumber);

        if (!error) processed++;
      }
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: `✅ Processed ${processed} records from MDE file.` });
  } catch (err) {
    console.error('❌ Error parsing MDE:', err.message);
    res.status(500).json({ success: false, message: 'Failed to process file' });
  }
});

module.exports = router;
