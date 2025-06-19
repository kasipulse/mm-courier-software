// routes/fedex.js
const express = require('express');
const xml2js = require('xml2js');
const db = require('../db'); // <-- this uses db.js
const router = express.Router();

router.post('/upload-xml', async (req, res) => {
  const xml = req.body.xml;
  const parser = new xml2js.Parser({ explicitArray: false });

  try {
    const result = await parser.parseStringPromise(xml);
    const data = result['soapenv:Envelope']['soapenv:Body']['v1:UploadScanRequest']['v1:MasterList'];

    const tracking = data['track-item-number'];
    const scanType = data['track-type'];
    const comments = data['comments'] || null;

    // Insert into Supabase
    await db.query(
      `INSERT INTO parcels (tracking_number, scan_type, status, comments) 
       VALUES ($1, $2, $3, $4)`,
      [tracking, scanType, 'Received', comments]
    );

    res.json({ message: 'Scan uploaded and saved', tracking });
  } catch (err) {
    console.error('XML parse or DB error:', err.message);
    res.status(400).json({ error: 'Invalid XML or DB issue' });
  }
});

module.exports = router;

