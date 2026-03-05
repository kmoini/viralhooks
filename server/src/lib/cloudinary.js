// ──────────────────────────────────────────────────
// Shared Cloudinary instance — single source of truth
//
// All server modules that need Cloudinary should:
//   const cloudinary = require('../lib/cloudinary');
// ──────────────────────────────────────────────────
const { v2: cloudinary } = require('cloudinary');

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key    = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;

if (cloud_name && api_key && api_secret) {
  cloudinary.config({ cloud_name, api_key, api_secret });
  console.log(
    `[CLOUDINARY] configured: cloud_name=${cloud_name}, api_key=present, api_secret=present`
  );
} else {
  console.warn(
    '[CLOUDINARY] NOT configured — missing env vars.' +
    ` cloud_name=${cloud_name ? 'present' : 'ABSENT'},` +
    ` api_key=${api_key ? 'present' : 'ABSENT'},` +
    ` api_secret=${api_secret ? 'present' : 'ABSENT'}.` +
    ' Uploads will fail until CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are set in server/.env'
  );
}

module.exports = cloudinary;
