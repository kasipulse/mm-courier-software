// ✅ POD Upload route — upload image + update parcel + send to ParcelPerfect
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const axios = require('axios');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer();

router.post('/pod', upload.single('image'), async (req, res) => {
  const { tracking_number, received_by, delivered_at_time } = req.body;
  const file = req.file;

  if (!file || !tracking_number || !received_by || !delivered_at_time) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    // Step 1: Upload image to Cloudinary
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

    // Step 2: Update Supabase
    const { data, error } = await supabase
      .from('parcels')
      .update({
        status: 'Delivered',
        pod_url: uploadResult.secure_url,
        received_by,
        delivered_at: new Date().toISOString(),
        delivered_at_time
      })
      .eq('tracking_number', tracking_number)
      .eq('status', 'Scanned Out')
      .single();

    if (error || !data) throw error || new Error('Parcel not found or not eligible for POD.');

    // ✅ Step 3: Automatically send to ParcelPerfect JSON API
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
