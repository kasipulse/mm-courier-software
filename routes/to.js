const express = require('express'); 
const router = express.Router();
const multer = require('multer');
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');

// Multer handles the file upload
const upload = multer();

// Connect to Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// MDE Upload Route
router.post('/mde-upload', upload.single('mdeFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const xml = req.file.buffer.toString('utf8');
  console.log('📄 Raw MDE file content (preview):', xml.slice(0, 300));

  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsed = await parser.parseStringPromise(xml);

    const record = parsed.XMLmde;
    if (!record) {
      console.error('❌ Parsed XML does not contain <XMLmde> root');
      return res.status(400).json({ success: false, message: 'Invalid MDE XML structure' });
    }

    const tracking = record.mdeTrackNbr || record.mdeAirbillNbr;
    const consignee = record.mdeConsigneeNm || '';
    const phone = record.mdeConsigneePhone || '';
    const address = record.mdeConsigneeAddress1 || '';
    const weight = parseFloat(record.mdeTotWeight || '0') || 0;
    const description = record.mdeDescription?.trim() || '';
    const formType = record.mdeFormTypeCd || '';

    // 🧪 Test Output Logging
    console.log('✅ Extracted Values:');
    console.log('Tracking Number:', tracking);
    console.log('Consignee:', consignee);
    console.log('Phone:', phone);
    console.log('Address:', address);
    console.log('Weight:', weight);
    console.log('Description:', description);
    console.log('Form Type Code:', formType);

    if (!tracking) {
      console.error('❌ Missing tracking number');
      return res.status(400).json({ success: false, message: 'Tracking number missing in MDE' });
    }

    const { error } = await supabase.from('parcels').insert([{
      tracking_number: tracking,
      recipient_name: consignee,
      recipient_phone: phone,
      delivery_address: address,
      weight,
      description,
      form_type: formType,
      status: 'Pending'
    }]);

    if (error) {
      console.error('❌ Supabase Insert Error:', error.message);
      throw error;
    }

    console.log('✅ Inserted into Supabase:', tracking);
    res.json({ success: true, message: `✅ Parcel ${tracking} imported.` });

  } catch (err) {
    console.error('❌ Parse or Insert Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to process MDE file.' });
  }
});

module.exports = router;
