// Load environment variables FIRST (before anything reads them)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');

// ── Decide mode: ANIMATOR, RUNWAY, KLING, or MOCK ────────
// Env vars:
//   USE_ANIMATOR=true        → Python reenactment pipeline
//   USE_RUNWAY=true          → Runway gen3a_turbo
//   USE_KLING=true           → Kling 2.6 via PiAPI (requires KLING_API_KEY + PUBLIC_BASE_URL)
//   (none of the above)      → Mock mode
// ──────────────────────────────────────────────────────────
const USE_ANIMATOR = process.env.USE_ANIMATOR === 'true';

const apiKey       = process.env.RUNWAYML_API_SECRET || '';
const keyLooksReal = apiKey.length > 0
  && !apiKey.includes('PASTE')
  && !apiKey.includes('placeholder')
  && !apiKey.includes('HERE');

// Animator takes priority; Runway only if animator is off; Kling only if neither
const USE_RUNWAY = !USE_ANIMATOR && process.env.USE_RUNWAY === 'true' && keyLooksReal;
const USE_KLING  = !USE_ANIMATOR && !USE_RUNWAY && process.env.USE_KLING === 'true';

let runway = null;
if (USE_RUNWAY) {
  runway = require('./runwayClient');
}

let kling = null;
let uploadSelfieToCloudinary = null;
if (USE_KLING) {
  kling = require('./klingClient');
  ({ uploadSelfieToCloudinary } = require('./cloudinaryUpload'));
}

let animator = null;
if (USE_ANIMATOR) {
  animator = require('./animatorClient');
}

const { getTemplate }      = require('./danceTemplates');
const { postprocessVideo } = require('./videoPostprocess');

// ── Viral render modules ────────────────────────────────
const { pickTrendingSound, pickBestTemplateForSound, computeTimingPlan } = require('./src/services/soundMatch');
const { processVideo: processViralVideo, muxAudioIntoVideo, downloadToFile: downloadToFileFfmpeg, safeDelete } = require('./src/services/ffmpegPost');
// viralTemplates loaded internally by soundMatch — available here if needed later
// const { getViralTemplate, VIRAL_TEMPLATES } = require('./src/data/viralTemplates');

// ── Music system modules ────────────────────────────────
const musicRoutes = require('./src/routes/musicRoutes');
const musicStore = require('./src/music/musicStore');
const { getTemplateBpm } = require('./src/constants/templateBpm');
const { getViralTemplate } = require('./src/data/viralTemplates');

// ── Post-process mode: "OFF" or "LETTERBOX_916" ──────────
const POSTPROCESS_MODE = process.env.POSTPROCESS_MODE || 'OFF';

// ── Driver videos directory ─────────────────────────────
const driversDir = path.join(__dirname, 'drivers');

// ── File upload setup ────────────────────────────────────
// Uploaded images go into server/uploads/
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },   // 50 MB max
});

// ── Output videos directory ─────────────────────────────
// Generated/post-processed videos are saved here and served as static files.
const videosDir = path.join(__dirname, 'public', 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// ── Express setup ────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve output videos at /videos/<taskId>.mp4
app.use('/videos', express.static(path.join(__dirname, 'public', 'videos')));

// Serve uploaded images at /uploads/<filename>  (needed for Kling — requires public URL)
app.use('/uploads', express.static(uploadsDir));

// ── Mount music routes ──────────────────────────────────
app.use('/api/music', musicRoutes);

// ── Public URL builder ──────────────────────────────────
// Combines PUBLIC_BASE_URL with a local pathname.
// Required when USE_KLING=true (Kling/PiAPI needs a publicly reachable image URL).
// Example: buildPublicUrl('/uploads/abc.jpg') -> 'https://xyz.ngrok.app/uploads/abc.jpg'
function buildPublicUrl(pathname) {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    if (process.env.USE_KLING === 'true') {
      throw new Error(
        'PUBLIC_BASE_URL is required when USE_KLING=true. ' +
        'Set it to your public tunnel URL (e.g. https://xyz.ngrok.app).'
      );
    }
    // Non-Kling modes don't need it — return a relative path as fallback
    return pathname.startsWith('/') ? pathname : `/${pathname}`;
  }
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = pathname.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

// In-memory job store
const jobs = {};

// Viral render concurrency limiter (max 2 simultaneous FFmpeg jobs)
let viralActiveCount = 0;
const VIRAL_MAX_CONCURRENT = 2;

// ── Aspect ratio fixer ───────────────────────────────
// Runway requires width/height >= 0.5 (i.e. image can't
// be taller than 2:1). If the photo is too tall, we trim
// just enough height (centered) to reach the 0.5 minimum.
// Images that already pass are returned untouched.
async function ensureRunwayAspectRatio(inputPath) {
  const meta  = await sharp(inputPath).metadata();
  const ratio = meta.width / meta.height;

  if (ratio >= 0.5) {
    console.log(`[PREPROCESS] Aspect ratio ${ratio.toFixed(3)} OK — no change needed`);
    return inputPath;
  }

  // Too tall — crop height so ratio becomes 0.5 (minimum Runway allows)
  const newHeight = Math.floor(meta.width / 0.5);   // = width * 2
  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, `_fixed${ext}`);

  await sharp(inputPath)
    .resize(meta.width, newHeight, { fit: 'cover', position: 'centre' })
    .toFile(outputPath);

  console.log(`[PREPROCESS] Trimmed ${meta.width}x${meta.height} -> ${meta.width}x${newHeight} (ratio ${(meta.width/newHeight).toFixed(3)})`);
  return outputPath;
}

// ── Download a remote file to disk (fetch + stream) ─────
async function downloadFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const fileStream = fs.createWriteStream(outPath);
  const { Readable } = require('stream');
  const readable = Readable.fromWeb(res.body);
  await new Promise((resolve, reject) => {
    readable.pipe(fileStream);
    readable.on('error', reject);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

// ── POST /api/animate  –  start a job ────────────────────
// Accepts EITHER:
//   - multipart/form-data with "image" file + text fields
//   - JSON body (legacy, for backwards compat)
app.post('/api/animate', upload.single('image'), async (req, res) => {
  const templateId      = req.body.templateId;
  const durationSeconds = Number(req.body.durationSeconds);
  const imageUrl        = req.body.imageUrl;       // optional (for future URL-based flow)

  // Only 5-second clips for now
  if (durationSeconds !== 5) {
    return res.status(400).json({ error: 'durationSeconds must be 5' });
  }

  // Log uploaded file
  if (req.file) {
    console.log(`[UPLOAD] Image saved: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)} KB)`);
  }

  const taskId = crypto.randomUUID();

  // ---- ANIMATOR MODE (PhotoDance-style pipeline) ----
  if (USE_ANIMATOR) {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required for Animator mode' });
    }

    const template = getTemplate(templateId);
    console.log(`[ANIMATOR] Using template: "${template.name}" (driver: ${template.driverVideo})`);

    // Resolve driver video path
    const driverPath = path.join(driversDir, template.driverVideo);
    if (!fs.existsSync(driverPath)) {
      console.error(`[ANIMATOR] Driver video not found: ${driverPath}`);
      return res.status(500).json({ error: `Driver video not found: ${template.driverVideo}` });
    }

    // Create job as PENDING, then run animation in background
    const outputPath = path.join(videosDir, `${taskId}.mp4`);

    jobs[taskId] = {
      status:    'PENDING',
      createdAt: Date.now(),
      imagePath: req.file.path,
      mode:      'animator',
    };

    // Fire-and-forget: call Python service in background
    animator.callAnimator(req.file.path, driverPath, outputPath)
      .then(() => {
        // Verify the mp4 was actually written
        if (fs.existsSync(outputPath)) {
          jobs[taskId].status     = 'SUCCEEDED';
          jobs[taskId].outputFile = `${taskId}.mp4`;
          console.log(`[ANIMATOR] Job ${taskId} SUCCEEDED -> ${taskId}.mp4`);
        } else {
          jobs[taskId].status = 'FAILED';
          jobs[taskId].error  = 'Output mp4 was not created';
          console.error(`[ANIMATOR] Job ${taskId} FAILED — output file missing`);
        }
      })
      .catch((err) => {
        jobs[taskId].status = 'FAILED';
        jobs[taskId].error  = err.message;
        console.error(`[ANIMATOR] Job ${taskId} FAILED:`, err.message);
      });

    console.log(`[ANIMATOR] Job ${taskId} started`);
    return res.json({ taskId });
  }

  // ---- RUNWAY MODE ----
  if (USE_RUNWAY) {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required for Runway mode' });
    }
    try {
      // Look up the template preset (prompt + settings)
      const template = getTemplate(templateId);
      console.log(`[RUNWAY] Using template: "${template.name}"`);

      // Only fix aspect ratio if Runway would reject it (too tall/narrow)
      const imagePath    = await ensureRunwayAspectRatio(req.file.path);
      const runwayTaskId = await runway.startImageToVideo(imagePath, template);

      jobs[taskId] = {
        status:      'PENDING',
        createdAt:   Date.now(),
        runwayTaskId,
        imagePath:   req.file.path,
        mode:        'runway',
      };

      console.log(`[RUNWAY] Job ${taskId} -> Runway task ${runwayTaskId}`);
      return res.json({ taskId });
    } catch (err) {
      console.error('[RUNWAY] Failed to start:', err.message);
      return res.status(500).json({ error: 'Failed to start Runway job' });
    }
  }

  // ---- KLING MODE ----
  if (USE_KLING) {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required for Kling mode' });
    }
    try {
      let template = getTemplate(templateId);

      // Fall back to template '1' if this template has no kling config
      if (!template.kling) {
        console.log(`[KLING] Template "${template.name}" has no kling config, falling back to template 1`);
        template = getTemplate('1');
      }

      const imageUrl = await uploadSelfieToCloudinary(req.file.path, req.file.filename);
      console.log(`[CLOUDINARY] Uploaded selfie -> ${imageUrl}`);
      console.log(`[KLING] Using template: "${template.name}", image: ${imageUrl}`);

      const providerTaskId = await kling.startImageToVideo({
        imageUrl,
        templateKling: template.kling,
      });

      jobs[taskId] = {
        status:            'PENDING',
        mode:              'kling',
        providerTaskId,
        templateId,
        uploadedImagePath: req.file.path,
        uploadedFilename:  req.file.filename,
        createdAt:         Date.now(),
      };

      console.log(`[KLING] Job ${taskId} -> PiAPI task ${providerTaskId}`);
      return res.json({ taskId });
    } catch (err) {
      console.error('[KLING] Failed to start:', err.message);
      return res.status(500).json({ error: 'Failed to start Kling job' });
    }
  }

  // ---- MOCK MODE (default fallback) ----
  jobs[taskId] = {
    status:    'PENDING',
    createdAt: Date.now(),
    imagePath: req.file ? req.file.path : null,
    mode:      'mock',
  };

  setTimeout(() => {
    jobs[taskId].status   = 'SUCCEEDED';
    jobs[taskId].videoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
  }, 4000);

  console.log(`[MOCK] Job ${taskId} for template ${templateId}`);
  res.json({ taskId });
});

// ── POST /api/render/viral  –  sound-synced viral render ─
// Picks a trending sound, matches a template, generates via
// provider, then post-processes with FFmpeg for beat sync.
//
// Request body (JSON):
//   selfieUrl    - publicly accessible image URL (required)
//   region       - e.g. "CA" (optional, default "CA")
//   energyType   - "hype"|"smooth"|"meme" (optional)
//   loopToSec    - 8|24|36 (optional, default: no loop)
//   provider     - "KLING"|"VIGGLE" (optional, default: auto)
// ──────────────────────────────────────────────────────────
app.post('/api/render/viral', async (req, res) => {
  try {
    const { selfieUrl, region, energyType, loopToSec, provider, musicId, templateId: reqTemplateId, mixMode } = req.body;

    // ── Validate ──
    if (!selfieUrl || typeof selfieUrl !== 'string') {
      return res.status(400).json({ error: 'selfieUrl is required (public image URL)' });
    }

    if (energyType && !['hype', 'smooth', 'meme'].includes(energyType)) {
      return res.status(400).json({ error: 'energyType must be "hype", "smooth", or "meme"' });
    }

    const validMixMode = (mixMode === 'withMusic' || mixMode === 'mute') ? mixMode : 'mute';

    const validLoopValues = [8, 24, 36];
    const validLoopTo = loopToSec && validLoopValues.includes(Number(loopToSec))
      ? Number(loopToSec)
      : undefined;

    // ── Concurrency check ──
    if (viralActiveCount >= VIRAL_MAX_CONCURRENT) {
      return res.status(429).json({
        error: `Too many viral renders in progress (${viralActiveCount}/${VIRAL_MAX_CONCURRENT}). Try again shortly.`,
      });
    }

    let sound, template, timingPlan, musicMeta;

    // ── New path: musicId provided → user-selected music beat-sync ──
    if (musicId) {
      const music = musicStore.get(musicId);
      if (!music) {
        return res.status(404).json({ error: `Music not found: ${musicId}` });
      }

      // Use the requested templateId, falling back to best viral template
      let chosenTemplate = null;
      if (reqTemplateId) {
        chosenTemplate = getViralTemplate(reqTemplateId);
      }
      if (!chosenTemplate) {
        // Pick first viral template as default
        chosenTemplate = getViralTemplate('viral_hype_105');
      }
      template = chosenTemplate;

      // Beat-sync: speedFactor = musicBpm / templateBpm
      const templateBpm = getTemplateBpm(template.templateId || reqTemplateId);
      const speedFactor = Math.round((music.bpm / templateBpm) * 1000) / 1000;
      // Clamp speed to reasonable range (0.75 - 1.35)
      const clampedSpeed = Math.max(0.75, Math.min(1.35, speedFactor));

      timingPlan = {
        speedFactor: clampedSpeed,
        leadHoldSec: 0,
        targetDurationSec: 8.0,
        bpmDelta: Math.abs(music.bpm - templateBpm),
        clamped: clampedSpeed !== speedFactor,
      };

      // Build music metadata for response
      musicMeta = {
        musicId: music.musicId,
        title: music.title,
        artist: music.artist,
        bpm: music.bpm,
        bpmDetected: music.bpmDetected,
        source: music.source,
        audioUrl: music.audioUrl,
      };

      // No TikTok sound for user-selected music
      sound = null;

      console.log(`[VIRAL] ── New music-synced render ──`);
      console.log(`[VIRAL] Music: "${music.title}" by ${music.artist} (${music.bpm} BPM, detected=${music.bpmDetected})`);
      console.log(`[VIRAL] Template: "${template.name}" (${templateBpm} BPM)`);
      console.log(`[VIRAL] Beat-sync: speed=${timingPlan.speedFactor}, delta=${timingPlan.bpmDelta} BPM, clamped=${timingPlan.clamped}`);
      console.log(`[VIRAL] Mix mode: ${validMixMode}`);

    } else {
      // ── Old path: pick trending sound + match template ──
      sound = pickTrendingSound({ region: region || 'CA', energyType });
      if (!sound) {
        return res.status(500).json({ error: 'No trending sounds available for this region/energy' });
      }

      template = pickBestTemplateForSound(sound);
      timingPlan = computeTimingPlan(sound, template);
      musicMeta = null;

      console.log(`[VIRAL] ── New viral render ──`);
      console.log(`[VIRAL] Sound: "${sound.soundName}" (${sound.bpm} BPM, ${sound.energyType})`);
      console.log(`[VIRAL] Template: "${template.name}" (${template.baseBpm} BPM, ${template.energyType})`);
      console.log(`[VIRAL] Timing: speed=${timingPlan.speedFactor}, hold=${timingPlan.leadHoldSec}s, delta=${timingPlan.bpmDelta} BPM, clamped=${timingPlan.clamped}`);
    }

    if (validLoopTo) console.log(`[VIRAL] Loop: ${validLoopTo}s`);

    const taskId = crypto.randomUUID();

    // ── Build provider prompt with BPM/timing hints ──
    const bpmForPrompt = musicMeta ? musicMeta.bpm : sound.bpm;
    const dropForPrompt = sound ? sound.dropTimeSec : 1.0;
    const timingHint =
      `Dance feel: ${bpmForPrompt} BPM. ` +
      `Big accent hit at ~${dropForPrompt}s. ` +
      `8-count structure. Return to starting pose for loop. `;
    const fullPrompt = timingHint + template.prompt;

    // Sound metadata for the response (no audio files — metadata only)
    const soundMeta = sound ? {
      soundId: sound.soundId,
      soundName: sound.soundName,
      bpm: sound.bpm,
      dropTimeSec: sound.dropTimeSec,
      tiktokUrl: sound.tiktokUrl,
    } : null;

    const timingsApplied = {
      speedFactor: timingPlan.speedFactor,
      leadHoldSec: timingPlan.leadHoldSec,
      targetDurationSec: timingPlan.targetDurationSec,
      loopToSec: validLoopTo || null,
    };

    // ── Determine provider ──
    const providerName = (provider || '').toUpperCase();
    const useKlingProvider =
      providerName === 'KLING' ||
      (!providerName && USE_KLING) ||
      (!providerName && process.env.KLING_API_KEY);

    if (useKlingProvider) {
      // Load Kling client (require is cached after first call)
      const klingClient = kling || require('./klingClient');

      const klingConfig = {
        ...template.kling,
        prompt: fullPrompt,
      };

      console.log(`[VIRAL] Starting Kling generation (duration: ${klingConfig.duration}s)...`);

      const providerTaskId = await klingClient.startImageToVideo({
        imageUrl: selfieUrl,
        templateKling: klingConfig,
      });

      viralActiveCount++;

      jobs[taskId] = {
        status: 'PENDING',
        mode: 'viral',
        providerMode: 'kling',
        providerTaskId,
        templateId: template.templateId,
        sound: soundMeta,
        music: musicMeta,
        mixMode: validMixMode,
        timingsApplied,
        loopToSec: validLoopTo,
        createdAt: Date.now(),
      };

      console.log(`[VIRAL] Job ${taskId} -> PiAPI task ${providerTaskId}`);

    } else {
      // ── Mock mode for viral ──
      viralActiveCount++;

      jobs[taskId] = {
        status: 'PENDING',
        mode: 'viral',
        providerMode: 'mock',
        templateId: template.templateId,
        sound: soundMeta,
        music: musicMeta,
        mixMode: validMixMode,
        timingsApplied,
        loopToSec: validLoopTo,
        createdAt: Date.now(),
      };

      // Simulate success after 4 seconds
      setTimeout(() => {
        jobs[taskId].status = 'SUCCEEDED';
        jobs[taskId].videoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
        viralActiveCount = Math.max(0, viralActiveCount - 1);
        console.log(`[VIRAL-MOCK] Job ${taskId} SUCCEEDED`);
      }, 4000);

      console.log(`[VIRAL-MOCK] Job ${taskId} started (no real provider)`);
    }

    // ── Return immediately with PENDING + metadata ──
    return res.json({
      taskId,
      status: 'PENDING',
      sound: soundMeta,
      music: musicMeta,
      templateId: template.templateId,
      timingsApplied,
    });

  } catch (err) {
    console.error('[VIRAL] Route error:', err);
    return res.status(500).json({ error: 'Viral render failed: ' + err.message });
  }
});

// ── GET /api/task/:taskId  –  poll job status ────────────
// For animator mode: job is updated in-place by the background promise.
// For runway mode: POSTPROCESS_MODE controls what happens after Runway finishes.
app.get('/api/task/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const job = jobs[taskId];

  if (!job) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // ── Runway: check status ──
  if (job.mode === 'runway' && job.status === 'PENDING' && !job.postProcessStarted) {
    try {
      const result = await runway.getRunwayTaskStatus(job.runwayTaskId);

      if (result.status === 'SUCCEEDED' && result.videoUrl) {

        if (POSTPROCESS_MODE === 'OFF') {
          // ── OFF: return raw Runway URL directly ──
          job.status   = 'SUCCEEDED';
          job.videoUrl = result.videoUrl;
          console.log(`[RUNWAY] Job ${taskId} SUCCEEDED (postprocess OFF, raw URL)`);

        } else if (POSTPROCESS_MODE === 'LETTERBOX_916') {
          // ── LETTERBOX: download + ffmpeg, stay PENDING until done ──
          job.postProcessStarted = true;
          console.log(`[POSTPROCESS] Starting letterbox for job ${taskId}`);

          const rawPath     = path.join(videosDir, `${taskId}_raw.mp4`);
          const outputPath  = path.join(videosDir, `${taskId}.mp4`);

          postprocessVideo(result.videoUrl, rawPath, outputPath)
            .then(() => {
              job.status      = 'SUCCEEDED';
              job.croppedFile = `${taskId}.mp4`;
              console.log(`[POSTPROCESS] Job ${taskId} complete`);
            })
            .catch((err) => {
              console.error(`[POSTPROCESS] Failed for ${taskId}:`, err.message);
              job.status = 'FAILED';
              job.error  = 'Video post-processing failed';
            });

        } else {
          // Unknown mode — treat as OFF
          job.status   = 'SUCCEEDED';
          job.videoUrl = result.videoUrl;
        }

      } else if (result.status === 'FAILED') {
        job.status = 'FAILED';
        job.error  = result.error;
      }
    } catch (err) {
      console.error('[RUNWAY] Poll error:', err.message);
    }
  }

  // ── Kling: check status ──
  if (job.mode === 'kling' && job.status === 'PENDING') {
    try {
      const taskData      = await kling.getTask(job.providerTaskId);
      const mappedStatus  = kling.mapStatus(taskData.status);

      if (mappedStatus === 'FAILED') {
        job.status = 'FAILED';
        job.error  = taskData.error?.message || taskData.error || taskData.message || 'Kling generation failed';
        console.log(`[KLING] Job ${taskId} FAILED — full response:`, JSON.stringify(taskData, null, 2));

      } else if (mappedStatus === 'SUCCEEDED') {
        const remoteUrl = kling.extractVideoUrl(taskData);

        if (!remoteUrl) {
          // Video not ready yet despite "completed" status — keep polling
          console.log(`[KLING] Job ${taskId} completed but video URL not available yet`);
        } else {
          const localPath = path.join(videosDir, `${taskId}.mp4`);

          // Download only if we haven't already
          if (!fs.existsSync(localPath)) {
            try {
              console.log(`[KLING] Downloading video for job ${taskId}...`);
              await downloadFile(remoteUrl, localPath);
              console.log(`[KLING] Downloaded -> ${taskId}.mp4`);
            } catch (dlErr) {
              // Transient download failure — stay PENDING, retry on next poll
              console.error(`[KLING] Download failed for ${taskId}:`, dlErr.message);
            }
          }

          if (fs.existsSync(localPath)) {
            job.status   = 'SUCCEEDED';
            job.videoUrl = buildPublicUrl(`/videos/${taskId}.mp4`);
            console.log(`[KLING] Job ${taskId} SUCCEEDED`);
          }
        }
      }
      // mappedStatus === 'PENDING' → do nothing, stay PENDING
    } catch (err) {
      console.error('[KLING] Poll error:', err.message);
    }
  }

  // ── Viral: poll provider + FFmpeg post-process ──
  if (job.mode === 'viral' && job.status === 'PENDING') {
    // Step 1: poll the underlying provider
    if (job.providerMode === 'kling' && !job.viralPostStarted) {
      try {
        const klingClient = kling || require('./klingClient');
        const taskData = await klingClient.getTask(job.providerTaskId);
        const mappedStatus = klingClient.mapStatus(taskData.status);

        if (mappedStatus === 'FAILED') {
          job.status = 'FAILED';
          job.error = taskData.error?.message || taskData.error || 'Kling generation failed';
          viralActiveCount = Math.max(0, viralActiveCount - 1);
          console.log(`[VIRAL] Job ${taskId} provider FAILED`);

        } else if (mappedStatus === 'SUCCEEDED') {
          const remoteUrl = klingClient.extractVideoUrl(taskData);

          if (remoteUrl && !job.viralPostStarted) {
            // Provider done — start FFmpeg post-processing in background
            job.viralPostStarted = true;
            console.log(`[VIRAL] Provider done for ${taskId}, starting post-process...`);

            const rawPath = path.join(videosDir, `${taskId}_raw.mp4`);

            // Fire-and-forget background processing
            (async () => {
              try {
                // Download raw provider video
                await downloadFile(remoteUrl, rawPath);
                console.log(`[VIRAL] Downloaded raw video for ${taskId}`);

                // Run FFmpeg pipeline (timing + watermark + trim + optional loop)
                const outputPath = await processViralVideo({
                  inputPath: rawPath,
                  speedFactor: job.timingsApplied.speedFactor,
                  leadHoldSec: job.timingsApplied.leadHoldSec,
                  targetDurationSec: job.timingsApplied.targetDurationSec,
                  loopToSec: job.loopToSec,
                });

                // ── Audio mux (if mixMode=withMusic and music available) ──
                let finalOutputPath = outputPath;
                if (job.mixMode === 'withMusic' && job.music && job.music.audioUrl) {
                  try {
                    const audioTempPath = path.join(videosDir, `${taskId}_audio_tmp.m4a`);
                    console.log(`[VIRAL] Downloading audio for mux: ${job.music.audioUrl}`);
                    await downloadToFileFfmpeg(job.music.audioUrl, audioTempPath);
                    const muxedPath = path.join(videosDir, `${taskId}_muxed.mp4`);
                    await muxAudioIntoVideo(
                      outputPath,
                      audioTempPath,
                      muxedPath,
                      job.timingsApplied.targetDurationSec || 8,
                    );
                    finalOutputPath = muxedPath;
                    safeDelete(audioTempPath);
                    safeDelete(outputPath); // remove silent version
                    console.log(`[VIRAL] Audio muxed into video for ${taskId}`);
                  } catch (muxErr) {
                    console.warn(`[VIRAL] Audio mux failed, using silent video: ${muxErr.message}`);
                    finalOutputPath = outputPath;
                  }
                }

                // Rename output to clean final filename
                const finalName = `${taskId}_viral.mp4`;
                const finalPath = path.join(videosDir, finalName);
                if (finalOutputPath !== finalPath) {
                  fs.renameSync(finalOutputPath, finalPath);
                }

                job.status = 'SUCCEEDED';
                job.videoUrl = buildPublicUrl(`/videos/${finalName}`);
                job.outputFile = finalName;
                console.log(`[VIRAL] Job ${taskId} SUCCEEDED -> ${finalName}`);

                // Cleanup raw download
                safeDelete(rawPath);

              } catch (postErr) {
                console.error(`[VIRAL] Post-process failed for ${taskId}:`, postErr.message);
                job.status = 'FAILED';
                job.error = 'FFmpeg post-processing failed: ' + postErr.message;
                // Keep raw file for debugging
                console.log(`[VIRAL] Raw file kept for debugging: ${rawPath}`);
              } finally {
                viralActiveCount = Math.max(0, viralActiveCount - 1);
              }
            })();
          }
          // If remoteUrl is null, provider says done but no URL yet — keep polling
        }
        // mappedStatus === 'PENDING' → keep waiting
      } catch (err) {
        console.error('[VIRAL] Poll error:', err.message);
      }
    }
    // Mock mode viral jobs are updated by setTimeout (no polling needed)
  }

  // ── Build response (same shape as always) ──
  const response = { status: job.status };

  if (job.status === 'SUCCEEDED') {
    if (job.outputFile) {
      // Animator or viral mode: locally generated mp4
      response.videoUrl = `http://${req.get('host')}/videos/${job.outputFile}`;
    } else if (job.croppedFile) {
      // Runway + postprocess mode
      response.videoUrl = `http://${req.get('host')}/videos/${job.croppedFile}`;
    } else if (job.videoUrl) {
      // Runway raw, mock, or viral-mock mode
      response.videoUrl = job.videoUrl;
    }
  }
  if (job.status === 'FAILED') response.error = job.error || 'Job failed';

  // ── Viral-specific response fields ──
  if (job.mode === 'viral') {
    if (job.sound) response.sound = job.sound;
    if (job.music) response.music = job.music;
    response.templateId = job.templateId;
    response.timingsApplied = job.timingsApplied;
    response.mixMode = job.mixMode || 'mute';
  }

  res.json(response);
});

// ── Start server ─────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  const mode = USE_ANIMATOR ? 'ANIMATOR (Python reenactment)'
             : USE_RUNWAY   ? 'RUNWAY (real API)'
             : USE_KLING    ? 'KLING 2.6 (PiAPI)'
             :                'MOCK (fake jobs)';

  console.log('');
  console.log(`SnapDance server running on http://0.0.0.0:${PORT}`);
  console.log(`Mode: ${mode}`);
  if (USE_ANIMATOR) {
    console.log(`Animator service: ${process.env.ANIMATOR_SERVICE_URL || 'http://localhost:8000'}`);
    console.log(`Drivers dir: ${driversDir}`);
  }
  console.log(`Postprocess: ${POSTPROCESS_MODE}`);
  console.log('');
});
