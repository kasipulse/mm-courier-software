const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🚚 POST: Upload any scan to FedEx (POD or DEX)
router.post('/send-fedex-scan/:trackingNumber/:scanType', async (req, res) => {
  const { trackingNumber, scanType } = req.params;

  // 🔍 Look up parcel by tracking number
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
  const dateStr = `${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = '1100';

  // 🧠 Configure fields per scan type
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

    default: // POD
      extraFields = `
        <received-by-name>${data.recipient_name || 'N/A'}</received-by-name>
        <edr-sig-rec-nbr>TESTSIGNATURE</edr-sig-rec-nbr>
        <edr-line-nbr>44</edr-line-nbr>
        <edr-del-address>${data.delivery_address || 'N/A'}</edr-del-address>
      `;
      break;
  }

  // 🧾 Build XML
  const xml = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v1="http://fedex.com/ws/uploadscan/v1">
  <soapenv:Header/>
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

  const url = 'https://wsbeta.fedex.com:443/web-services/uploadscan';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml
    });

    const text = await response.text();
    console.log(`📤 FedEx ${scanType} Response:`, text);

    if (response.ok) {
      res.json({ success: true, message: `✅ ${scanType} sent to FedEx.` });
    } else {
      res.status(500).json({ success: false, message: `❌ ${scanType} failed`, detail: text });
    }
  } catch (err) {
    console.error('❌ FedEx Upload Error:', err.message);
    res.status(500).json({ success: false, message: `Error uploading ${scanType}` });
  }
});

module.exports = router;
