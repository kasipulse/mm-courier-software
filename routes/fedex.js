// routes/fedex.js
const express = require('express');
const xml2js = require('xml2js');
const router = express.Router();

router.post('/upload-xml', async (req, res) => {
  let xml = req.body.xml;
  const parser = new xml2js.Parser({ explicitArray: false });

  try {
    const result = await parser.parseStringPromise(xml);
    // Example: extract a tracking number
    const items = result['soapenv:Envelope']['soapenv:Body']['v1:UploadScanRequest']['v1:MasterList'];
    const tracking = items['track-item-number'];

    res.json({ message: 'Scan uploaded', tracking });
  } catch (err) {
    console.error('Error parsing XML:', err);
    res.status(400).json({ error: 'Invalid XML' });
  }
});

module.exports = router;
