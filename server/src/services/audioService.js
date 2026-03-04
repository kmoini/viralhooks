/**
 * Audio Service — extract audio from video, upload to Cloudinary, get duration.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const cloudinary = require('cloudinary').v2;

/**
 * Run ffmpeg with given args.
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`));
    });
    proc.on('error', (err) => reject(err));
  });
}

/**
 * Extract audio from a video file → .m4a (AAC 192k).
 * @param {string} videoPath — path to input video
 * @returns {Promise<string>} path to extracted audio file
 */
async function extractAudioFromVideo(videoPath) {
  const audioPath = videoPath.replace(/\.[^.]+$/, '_audio.m4a');
  await runFfmpeg([
    '-i', videoPath,
    '-vn',
    '-acodec', 'aac',
    '-b:a', '192k',
    '-y', audioPath,
  ]);
  console.log('[AUDIO] Extracted audio:', audioPath);
  return audioPath;
}

/**
 * Upload audio file to Cloudinary.
 * Uses resource_type 'video' (Cloudinary handles audio under this type).
 * @param {string} localPath
 * @param {string} filename
 * @returns {Promise<string>} secure URL
 */
async function uploadAudioToCloudinary(localPath, filename) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const publicId = path.basename(filename, path.extname(filename));
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'video', // Cloudinary uses 'video' for audio files too
    folder: 'snapdance/audio',
    public_id: publicId,
  });

  console.log('[AUDIO] Uploaded to Cloudinary:', result.secure_url);
  return result.secure_url;
}

/**
 * Get audio duration in seconds using ffmpeg.
 * @param {string} audioPath
 * @returns {Promise<number>}
 */
async function getAudioDuration(audioPath) {
  try {
    // Use ffmpeg to get duration from stderr output
    const stderr = await runFfmpeg([
      '-i', audioPath,
      '-f', 'null',
      '-',
    ]).catch((err) => {
      // ffmpeg writes info to stderr even on "failure" for null output
      return err.message;
    });

    const stderrStr = typeof stderr === 'string' ? stderr : '';
    const match = stderrStr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }

    return 0;
  } catch (err) {
    console.warn('[AUDIO] Could not get duration:', err.message);
    return 0;
  }
}

/**
 * Safely delete a file.
 */
function safeDelete(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
}

module.exports = {
  extractAudioFromVideo,
  uploadAudioToCloudinary,
  getAudioDuration,
  safeDelete,
};
