const express = require('express');
const router = express.Router();
const multer = require('multer');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

const upload = multer();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Upload & process FedEx MDE file
router.post('/mde-upload', upload.single('mdeFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileContent = req.file.buffer.toString('utf8');

  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsed = await parser.parseStringPromise(fileContent);
    
    const record = parsed?.XMLmde;
    const tracking = record?.mdeTrackNbr;
    const consignee = record?.mdeConsigneeNm || '';
    const phone = record?.mdeConsigneePhone || '';
    const address = record?.mdeConsigneeAddress1 || '';
    const weight = record?.mdeTotWeight || '';
    const description = record?.mdeDescription?.trim() || '';

    if (!tracking) {
      return res.status(400).json({ success: false, message: 'Tracking number missing in MDE' });
    }

    // Insert into Supabase
    const { error } = await supabase
      .from('parcels')
      .insert([{
        tracking_number: tracking,
        recipient_name: consignee,
        recipient_phone: phone,
        delivery_address: address,
        weight: parseFloat(weight),
        description,
        status: 'Pending'
      }]);

    if (error) throw error;

    res.json({ success: true, message: `✅ 1 parcel imported: ${tracking}` });
  } catch (err) {
    console.error('❌ MDE Parse Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to process MDE file.' });
  }
});

module.exports = router;
