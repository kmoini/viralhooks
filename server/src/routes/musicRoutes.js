/**
 * Music Routes — GET list, GET by id, POST upload-audio, POST extract-from-video.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const musicStore = require('../music/musicStore');
const { detectBPM } = require('../services/bpmService');
const { extractAudioFromVideo, uploadAudioToCloudinary, getAudioDuration, safeDelete } = require('../services/audioService');

const router = express.Router();

// Multer config: store uploads in server/uploads with UUID filenames
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
});

/**
 * GET /api/music/list
 * Returns all music entries (catalog + user uploads/extracts).
 */
router.get('/list', (_req, res) => {
  try {
    const entries = musicStore.list();
    console.log(`[MUSIC] list → ${entries.length} entries`);
    res.json({ music: entries });
  } catch (err) {
    console.error('[MUSIC] list error:', err.message);
    res.status(500).json({ error: 'Failed to list music' });
  }
});

/**
 * GET /api/music/:musicId
 * Returns a single music entry by ID.
 */
router.get('/:musicId', (req, res) => {
  try {
    const entry = musicStore.get(req.params.musicId);
    if (!entry) {
      return res.status(404).json({ error: 'Music not found' });
    }
    console.log(`[MUSIC] get ${req.params.musicId}`);
    res.json(entry);
  } catch (err) {
    console.error('[MUSIC] get error:', err.message);
    res.status(500).json({ error: 'Failed to get music' });
  }
});

/**
 * POST /api/music/upload-audio
 * Upload an audio file directly. Analyzes BPM, uploads to Cloudinary.
 * multipart/form-data: file (audio)
 * Optional body: title, artist
 */
router.post('/upload-audio', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  try {
    console.log('[MUSIC] upload-audio:', req.file.originalname);

    // Detect BPM
    const { bpm, detected } = await detectBPM(filePath);
    console.log(`[BPM] ${req.file.originalname}: ${bpm} BPM (detected=${detected})`);

    // Get duration
    const durationSec = await getAudioDuration(filePath);

    // Upload to Cloudinary
    let audioUrl;
    try {
      audioUrl = await uploadAudioToCloudinary(filePath, req.file.filename);
    } catch (cloudErr) {
      console.warn('[MUSIC] Cloudinary upload failed, serving locally:', cloudErr.message);
      // Fallback: serve from local server
      audioUrl = `/uploads/${req.file.filename}`;
    }

    // Build music entry
    const musicId = `upload_${crypto.randomUUID().slice(0, 8)}`;
    const entry = {
      musicId,
      source: 'upload',
      title: req.body.title || req.file.originalname.replace(/\.[^.]+$/, ''),
      artist: req.body.artist || 'Unknown',
      previewUrl: audioUrl,
      audioUrl,
      bpm,
      bpmDetected: detected,
      durationSec: Math.round(durationSec * 10) / 10,
      createdAt: new Date().toISOString(),
    };

    musicStore.upsert(entry);

    // Clean up local file only if Cloudinary succeeded
    if (audioUrl.startsWith('http')) {
      safeDelete(filePath);
    }

    res.json(entry);
  } catch (err) {
    console.error('[MUSIC] upload-audio error:', err.message);
    safeDelete(filePath);
    res.status(500).json({ error: 'Failed to process audio upload' });
  }
});

/**
 * POST /api/music/extract-from-video
 * Upload a video, extract audio track, analyze BPM, upload audio to Cloudinary.
 * multipart/form-data: file (video)
 * Optional body: title, artist
 */
router.post('/extract-from-video', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  let audioPath = null;
  try {
    console.log('[MUSIC] extract-from-video:', req.file.originalname);

    // Extract audio from video
    audioPath = await extractAudioFromVideo(filePath);

    // Detect BPM from extracted audio
    const { bpm, detected } = await detectBPM(audioPath);
    console.log(`[BPM] ${req.file.originalname}: ${bpm} BPM (detected=${detected})`);

    // Get duration
    const durationSec = await getAudioDuration(audioPath);

    // Upload extracted audio to Cloudinary
    let audioUrl;
    try {
      audioUrl = await uploadAudioToCloudinary(audioPath, path.basename(audioPath));
    } catch (cloudErr) {
      console.warn('[MUSIC] Cloudinary upload failed, serving locally:', cloudErr.message);
      audioUrl = `/uploads/${path.basename(audioPath)}`;
    }

    // Build music entry
    const musicId = `extract_${crypto.randomUUID().slice(0, 8)}`;
    const entry = {
      musicId,
      source: 'extract',
      title: req.body.title || req.file.originalname.replace(/\.[^.]+$/, '') + ' (extracted)',
      artist: req.body.artist || 'Unknown',
      previewUrl: audioUrl,
      audioUrl,
      bpm,
      bpmDetected: detected,
      durationSec: Math.round(durationSec * 10) / 10,
      createdAt: new Date().toISOString(),
    };

    musicStore.upsert(entry);

    // Cleanup temp files
    safeDelete(filePath);
    if (audioUrl.startsWith('http')) {
      safeDelete(audioPath);
    }

    res.json(entry);
  } catch (err) {
    console.error('[MUSIC] extract-from-video error:', err.message);
    safeDelete(filePath);
    if (audioPath) safeDelete(audioPath);
    res.status(500).json({ error: 'Failed to extract audio from video' });
  }
});

module.exports = router;
