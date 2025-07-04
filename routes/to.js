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


// 🧪 Step 3.1: Generate FedEx XML for a Parcel
router.get('/generate-test-xml/:trackingNumber', async (req, res) => {
  const trackingNumber = req.params.trackingNumber;

  const { data, error } = await supabase
    .from('parcels')
    .select('*')
    .eq('tracking_number', trackingNumber)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, message: 'Parcel not found' });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');

  const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://fedex.com/ws/uploadscan/v1">
  <soapenv:Header/>
  <soapenv:Body>
    <v1:UploadScanRequest>
      <v1:WebAuthenticationDetail>
        <v1:UserCredential>
          <v1:Key>${process.env.FEDEX_KEY || 'YOUR_FEDEX_KEY'}</v1:Key>
          <v1:Password>${process.env.FEDEX_PASSWORD || 'YOUR_FEDEX_PASSWORD'}</v1:Password>
        </v1:UserCredential>
      </v1:WebAuthenticationDetail>
      <v1:Version>
        <v1:ServiceId>uploadscanservice</v1:ServiceId>
        <v1:Major>1</v1:Major>
        <v1:Intermediate>1</v1:Intermediate>
        <v1:Minor>0</v1:Minor>
      </v1:Version>
      <v1:MasterList>
        <track-type>20</track-type>
        <device-id>ZAJNBO0003</device-id>
        <track-date>${pad(now.getMonth() + 1)}${pad(now.getDate())}</track-date>
        <track-location-code>ALJB</track-location-code>
        <employee-number>5011892</employee-number>
        <track-begin-function-time>1100</track-begin-function-time>
        <track-end-function-time>1100</track-end-function-time>
        <airbill-time>1100</airbill-time>
        <delivery-route-number>100</delivery-route-number>
        <track-item-number>${data.tracking_number}</track-item-number>
        <airbill-type-code>1</airbill-type-code>
        <received-by-name>${data.recipient_name || 'N/A'}</received-by-name>
        <edr-sig-rec-nbr>TESTSIGNATURE</edr-sig-rec-nbr>
        <edr-line-nbr>44</edr-line-nbr>
        <edr-del-address>${data.delivery_address || 'N/A'}</edr-del-address>
        <tracking-item-form-cd>${data.form_type || '0000'}</tracking-item-form-cd>
        <comments>${data.description || 'No comment'}</comments>
      </v1:MasterList>
    </v1:UploadScanRequest>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

module.exports = router;
