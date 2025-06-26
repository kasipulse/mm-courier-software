const express = require('express');
const router = express.Router();
const axios = require('axios');

// 🔐 Replace with your ParcelPerfect credentials
const PP_USERNAME = 'pakiso@ubp';
const PP_PASSWORD = 'zBLB8KFJ5g5XBYwz';
const PP_ENDPOINT = 'https://brlweb12904.pperfect.com/ppintegrationservice/v27/Json/';

// ✅ Send delivery update to ParcelPerfect
router.post('/send-pod', async (req, res) => {
  const { waybill_number, pod_url, delivered_by, delivered_date } = req.body;

  if (!waybill_number || !pod_url || !delivered_by || !delivered_date) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const payload = {
    Username: PP_USERNAME,
    Password: PP_PASSWORD,
    Request: 'AddProofOfDelivery',
    WaybillNumber: waybill_number,
    DeliveredBy: delivered_by,
    DeliveryDate: delivered_date,
    PODUrl: pod_url
  };

  try {
    const { data } = await axios.post(PP_ENDPOINT, payload);
    res.json({ success: true, response: data });
  } catch (err) {
    console.error('❌ Integration error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send to ParcelPerfect.' });
  }
});

module.exports = router;
