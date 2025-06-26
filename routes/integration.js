const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

// ParcelPerfect credentials (keep these in .env)
const PARCELPERFECT_URL = 'https://brlweb12904.pperfect.com/ppintegrationservice/v27/Json/';
const PP_USERNAME = process.env.PP_USERNAME;
const PP_PASSWORD = process.env.PP_PASSWORD;

router.post('/send-update', async (req, res) => {
  const { tracking_number, status, delivered_by } = req.body;

  const payload = {
    Method: 'UpdateTracking',
    Data: {
      TrackingNumber: tracking_number,
      Status: status,
      DeliveredBy: delivered_by,
      DeliveryDate: new Date().toISOString()
    }
  };

  const auth = Buffer.from(`${PP_USERNAME}:${PP_PASSWORD}`).toString('base64');

  try {
    const response = await axios.post(PARCELPERFECT_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    });

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('ParcelPerfect Error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to send update to ParcelPerfect.' });
  }
});

module.exports = router;
