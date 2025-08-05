const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const streamifier = require('streamifier');

// 🔌 Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🔌 Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

// 📦 Upload setup
const upload = multer();

/* ------------------ FEDEX SCAN UPLOAD ------------------ */
router.post('/send-fedex-scan/:trackingNumber/:scanType', async (req, res) => {
  const { trackingNumber, scanType } = req.params;
  const { data, error } = await supabase.from('parcels').select('*').eq('tracking_number', trackingNumber).single();
  if (error || !data) return res.status(404).json({ success: false, message: 'Parcel not found' });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = '1100';

  let trackType = '20';
  let extraFields = '';

  switch (scanType) {
    case 'DEX03':
      trackType = '30';
      extraFields = `
        <track-exception-code>03</track-exception-code>
        <recipient-name>${data.recipient_name}</recipient-name>
        <recipient-address-desc>${data.delivery_address}</recipient-address-desc>
        <delivered-address-desc>${data.delivery_address}</delivered-address-desc>
        <shipper-name>MM Courier</shipper-name>
      `;
      break;
    case 'DEX07':
      trackType = '30';
      extraFields = `
        <track-exception-code>07</track-exception-code>
        <recipient-company-name>MM Courier</recipient-company-name>
        <recipient-name>${data.recipient_name}</recipient-name>
        <recipient-address-desc>${data.delivery_address}</recipient-address-desc>
        <reason-refused>Damaged</reason-refused>
        <shipper-name>MM Courier</shipper-name>
      `;
      break;
    case 'DEX08':
      trackType = '30';
      extraFields = `
        <track-exception-code>08</track-exception-code>
        <recipient-address-desc>${data.delivery_address}</recipient-address-desc>
        <reattempted-delivery-time>${timeStr}</reattempted-delivery-time>
        <delivery-date>${dateStr}</delivery-date>
        <station-eta-time>1700</station-eta-time>
      `;
      break;
    default:
      extraFields = `
        <received-by-name>${data.recipient_name || 'N/A'}</received-by-name>
        <edr-sig-rec-nbr>TESTSIGNATURE</edr-sig-rec-nbr>
        <edr-line-nbr>44</edr-line-nbr>
        <edr-del-address>${data.delivery_address || 'N/A'}</edr-del-address>
      `;
  }

  const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://fedex.com/ws/uploadscan/v1">
  <soapenv:Body>
    <v1:UploadScanRequest>
      <v1:WebAuthenticationDetail>
        <v1:UserCredential>
          <v1:Key>${process.env.FEDEX_KEY}</v1:Key>
          <v1:Password>${process.env.FEDEX_PASSWORD}</v1:Password>
        </v1:UserCredential>
      </v1:WebAuthenticationDetail>
      <v1:Version>
        <v1:ServiceId>uploadscanservice</v1:ServiceId>
        <v1:Major>1</v1:Major>
        <v1:Intermediate>1</v1:Intermediate>
        <v1:Minor>0</v1:Minor>
      </v1:Version>
      <v1:MasterList>
        <track-type>${trackType}</track-type>
        <device-id>ZAJNBO0003</device-id>
        <track-date>${dateStr}</track-date>
        <track-location-code>ALJB</track-location-code>
        <employee-number>5011892</employee-number>
        <track-begin-function-time>${timeStr}</track-begin-function-time>
        <track-end-function-time>${timeStr}</track-end-function-time>
        <airbill-time>${timeStr}</airbill-time>
        <delivery-route-number>100</delivery-route-number>
        <track-item-number>${data.tracking_number}</track-item-number>
        <airbill-type-code>1</airbill-type-code>
        <tracking-item-form-cd>${data.form_type || '0000'}</tracking-item-form-cd>
        ${extraFields}
        <comments>${data.description || 'No comment'}</comments>
      </v1:MasterList>
    </v1:UploadScanRequest>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  try {
    const response = await fetch('https://wsbeta.fedex.com:443/web-services/uploadscan', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    const text = await response.text();
    console.log(`📤 FedEx ${scanType} Response:`, text);

    response.ok
      ? res.json({ success: true, message: `✅ ${scanType} sent to FedEx.` })
      : res.status(500).json({ success: false, message: `❌ ${scanType} failed`, detail: text });
  } catch (err) {
    console.error('❌ FedEx Upload Error:', err.message);
    res.status(500).json({ success: false, message: `Error uploading ${scanType}` });
  }
});

/* ------------------ DRIVER LOGIN (NO PASSWORD) ------------------ */
router.post('/api/auth/login', async (req, res) => {
  const { username } = req.body;
  console.log('🧪 Login attempt:', { username });

  if (!username) return res.status(400).json({ message: 'Missing username' });

  const { data, error } = await supabase.from('drivers').select('*').eq('username', username).single();
  if (error || !data) return res.status(401).json({ message: 'Driver not found' });

  res.json({
    success: true,
    message: 'Login successful',
    driver: { id: data.uuid, name: data.driver_name, route: data.route_number }
  });
});

/* ------------------ POD UPLOAD ------------------ */
router.post('/upload-pod/:parcelId', upload.single('pod'), async (req, res) => {
  const parcelId = req.params.parcelId;
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  const streamUpload = (buffer) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'mm-courier/pods' }, (error, result) => {
        result ? resolve(result) : reject(error);
      });
      streamifier.createReadStream(buffer).pipe(stream);
    });

  try {
    const result = await streamUpload(file.buffer);
    const { error } = await supabase
      .from('parcels')
      .update({ pod_url: result.secure_url, pod_uploaded_at: new Date().toISOString() })
      .eq('id', parcelId);
    if (error) throw error;

    res.json({ success: true, message: 'POD uploaded', url: result.secure_url });
  } catch (err) {
    console.error('❌ POD Upload Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to upload POD', error: err.message });
  }
});

/* ------------------ FEDEX SFTP SCAN FETCH ------------------ */
const Client = require('ssh2-sftp-client');
const fs = require('fs/promises');
const path = require('path');

router.get('/api/fetch-fedex-scans', async (req, res) => {
  const sftp = new Client();
  const remoteDir = '/inbound/mde';
  const localDir = '/tmp/fedex_scans';
  const processedFiles = [];

  try {
    await fs.mkdir(localDir, { recursive: true });
    await sftp.connect({
      host: process.env.FEDEX_SFTP_HOST,
      port: 22,
      username: process.env.FEDEX_SFTP_USER,
      password: process.env.FEDEX_SFTP_PASS
    });

    const fileList = await sftp.list(remoteDir);
    for (const file of fileList) {
      if (file.name.endsWith('.xml')) {
        const localPath = path.join(localDir, file.name);
        await sftp.get(path.join(remoteDir, file.name), localPath);
        processedFiles.push(file.name);
      }
    }

    await sftp.end();
    res.json({ success: true, message: `Fetched ${processedFiles.length} files.`, files: processedFiles });
  } catch (err) {
    console.error('❌ SFTP Fetch Error:', err.message);
    res.status(500).json({ success: false, message: 'Error fetching scan files.', error: err.message });
  }
});

const Client = require('ssh2-sftp-client');
const fs = require('fs/promises');
const path = require('path');

// 📥 Download FedEx scan XML files via SFTP
router.get('/api/fetch-fedex-scans', async (req, res) => {
  const sftp = new Client();
  const remoteDir = '/inbound/mde'; // FedEx scan folder
  const localDir = '/tmp/fedex_scans'; // Render-safe temp folder
  const processedFiles = [];

  try {
    // Ensure local folder exists
    await fs.mkdir(localDir, { recursive: true });

    // ✅ Connect to FedEx SFTP using production credentials
    await sftp.connect({
      host: 'prod.ec.fedex.com',
      port: 60022,
      username: 'LNPZAPAKISA',
      password: 'SuGBcr78hEz65Ux'
    });

    // 📄 List XML files in folder
    const fileList = await sftp.list(remoteDir);

    for (const file of fileList) {
      if (file.name.endsWith('.xml')) {
        const remotePath = `${remoteDir}/${file.name}`;
        const localPath = path.join(localDir, file.name);

        // ⬇️ Download XML file to Render /tmp directory
        await sftp.get(remotePath, localPath);
        processedFiles.push(file.name);
      }
    }

    await sftp.end();

    res.json({
      success: true,
      message: `✅ Downloaded ${processedFiles.length} scan file(s) from FedEx`,
      files: processedFiles
    });
  } catch (err) {
    console.error('❌ FedEx SFTP Fetch Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FedEx scan files',
      error: err.message
    });
  }
});


module.exports = router;
