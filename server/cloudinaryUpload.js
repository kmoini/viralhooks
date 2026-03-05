const cloudinary = require('./src/lib/cloudinary');
const fs = require('fs/promises');

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
