const { v2: cloudinary } = require('cloudinary');
const fs = require('fs/promises');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a selfie to Cloudinary, delete the local file, return the secure URL.
 * @param {string} localPath  - absolute path to the multer-saved file
 * @param {string} filename   - original filename (used as public_id)
 * @returns {Promise<string>} Cloudinary secure_url
 */
async function uploadSelfieToCloudinary(localPath, filename) {
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'image',
    folder: 'snapdance/uploads',
    public_id: filename.replace(/\.[^.]+$/, ''), // strip extension
  });

  await fs.unlink(localPath);

  return result.secure_url;
}

module.exports = { uploadSelfieToCloudinary };
