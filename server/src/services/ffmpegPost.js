// ──────────────────────────────────────────────────
// FFmpeg post-processing for viral render pipeline
//
// Takes a raw provider video and applies:
//   1) Lead-in hold (freeze first frame)
//   2) Speed adjustment to match song BPM
//   3) Trim to exact target duration
//   4) Optional loop to 24s / 36s
//   5) Watermark overlay
//   6) H.264 web-optimized output
//
// Uses ffmpeg-static (same binary the existing
// videoPostprocess.js uses). No extra dependencies.
// ──────────────────────────────────────────────────
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Check FFmpeg is available ───────────────────
/**
 * Verify that the ffmpeg binary exists and is executable.
 * Throws if not found.
 */
function ensureFfmpegAvailable() {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not provide a binary path. Is it installed?');
  }
  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`ffmpeg binary not found at ${ffmpegPath}`);
  }
  console.log(`[FFMPEG] Binary OK: ${ffmpegPath}`);
}

// ── Run ffmpeg command ──────────────────────────
/**
 * Spawn ffmpeg with the given args, return a promise.
 * Logs the command and captures stderr for errors.
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const cmdStr = args.join(' ');
    console.log(`[FFMPEG] Running: ffmpeg ${cmdStr}`);

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// ── Find a usable font for watermark ────────────
function findWatermarkFont() {
  const candidates = [
    'C:/Windows/Fonts/arial.ttf',           // Windows
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  // Linux (Debian/Ubuntu)
    '/usr/share/fonts/TTF/DejaVuSans.ttf',              // Linux (Arch)
    '/System/Library/Fonts/Helvetica.ttc',               // macOS
  ];

  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) return fontPath;
  }

  return null;
}

// ── Build FFmpeg video filter string ────────────
/**
 * Build the -vf filter chain for timing + watermark.
 *
 * @param {object} opts
 * @param {number} opts.speedFactor   - speed multiplier (0.88 to 1.12)
 * @param {number} opts.leadHoldSec   - seconds to freeze first frame
 * @param {string|null} opts.fontPath - path to TTF font for watermark (null to skip)
 * @returns {string} filter string
 */
function buildFilterChain({ speedFactor, leadHoldSec, fontPath }) {
  const filters = [];

  // 1) Lead-in hold: clone first frame for N seconds
  if (leadHoldSec > 0) {
    filters.push(`tpad=start_duration=${leadHoldSec}:start_mode=clone`);
  }

  // 2) Speed adjustment via setpts
  //    PTS/factor: factor > 1 = faster, factor < 1 = slower
  if (speedFactor !== 1.0) {
    filters.push(`setpts=PTS/${speedFactor}`);
  }

  // 3) Watermark text overlay (top-left, semi-transparent)
  if (fontPath) {
    // Escape backslashes and colons for FFmpeg filter syntax
    const escapedFont = fontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filters.push(
      `drawtext=text='SnapDance':fontfile='${escapedFont}':fontsize=20:fontcolor=white@0.4:x=16:y=16`
    );
  }

  return filters.length > 0 ? filters.join(',') : null;
}

// ── Main processing pipeline ────────────────────
/**
 * Process a raw provider video with beat-matched timing.
 *
 * @param {object} opts
 * @param {string}  opts.inputPath        - path to raw provider MP4
 * @param {number}  opts.speedFactor      - speed multiplier (0.88-1.12)
 * @param {number}  opts.leadHoldSec      - seconds to freeze first frame
 * @param {number}  opts.targetDurationSec - clip duration (default 8.0)
 * @param {number}  [opts.loopToSec]      - if set, loop the clip to this length (e.g. 24)
 * @param {string}  [opts.watermarkPath]  - not used (we use drawtext instead)
 * @returns {Promise<string>} path to the output MP4
 */
async function processVideo({
  inputPath,
  speedFactor = 1.0,
  leadHoldSec = 0,
  targetDurationSec = 8.0,
  loopToSec,
}) {
  ensureFfmpegAvailable();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  const dir = path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const baseClipPath = path.join(dir, `${baseName}_viral.mp4`);

  console.log(`[VIRAL-FFMPEG] Processing: ${path.basename(inputPath)}`);
  console.log(`[VIRAL-FFMPEG] Timing: speed=${speedFactor}, hold=${leadHoldSec}s, target=${targetDurationSec}s, loop=${loopToSec || 'none'}`);

  // ── Pass 1: Apply timing + watermark + trim ──
  const fontPath = findWatermarkFont();
  if (!fontPath) {
    console.log('[VIRAL-FFMPEG] No font found for watermark — skipping watermark');
  }

  const filterChain = buildFilterChain({ speedFactor, leadHoldSec, fontPath });

  const pass1Args = [
    '-i', inputPath,
  ];

  if (filterChain) {
    pass1Args.push('-vf', filterChain);
  }

  pass1Args.push(
    '-t', String(targetDurationSec),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-an',                    // silent — no audio track
    '-movflags', '+faststart',
    '-y',
    baseClipPath,
  );

  await runFfmpeg(pass1Args);
  console.log(`[VIRAL-FFMPEG] Base clip created: ${path.basename(baseClipPath)}`);

  // ── Pass 2 (optional): Loop to target length ──
  if (loopToSec && loopToSec > targetDurationSec) {
    const loopCount = Math.ceil(loopToSec / targetDurationSec);
    const loopedPath = path.join(dir, `${baseName}_looped.mp4`);

    // Create concat demuxer list file
    const concatListPath = path.join(dir, `${baseName}_concat.txt`);
    // Use forward slashes for FFmpeg compatibility
    const safePath = baseClipPath.replace(/\\/g, '/');
    const lines = Array(loopCount).fill(`file '${safePath}'`).join('\n');
    fs.writeFileSync(concatListPath, lines, 'utf8');

    try {
      await runFfmpeg([
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-t', String(loopToSec),
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y',
        loopedPath,
      ]);

      console.log(`[VIRAL-FFMPEG] Looped to ${loopToSec}s: ${path.basename(loopedPath)}`);

      // Clean up concat list and base clip
      safeDelete(concatListPath);
      safeDelete(baseClipPath);

      return loopedPath;
    } catch (err) {
      // If loop fails, return the base clip instead
      console.error(`[VIRAL-FFMPEG] Loop failed, returning base clip: ${err.message}`);
      safeDelete(concatListPath);
      return baseClipPath;
    }
  }

  return baseClipPath;
}

// ── Safe file delete ────────────────────────────
function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`[VIRAL-FFMPEG] Could not delete ${filePath}: ${err.message}`);
  }
}

// ── Download a URL to a temp file ───────────────
/**
 * Download a URL to a local file (Node 18+ fetch).
 * Handles redirects automatically.
 *
 * @param {string} url     - HTTP/HTTPS URL
 * @param {string} outPath - local file path
 */
async function downloadToFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} for ${url}`);
  }

  const { Readable } = require('stream');
  const fileStream = fs.createWriteStream(outPath);
  const readable = Readable.fromWeb(res.body);

  await new Promise((resolve, reject) => {
    readable.pipe(fileStream);
    readable.on('error', reject);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

// ── Mux audio into video ────────────────────────
/**
 * Mux an audio track into an existing (silent) video.
 * Trims both to durationSec. Audio is re-encoded to AAC 192k.
 *
 * @param {string} videoPath   - path to silent video MP4
 * @param {string} audioPath   - path to audio file (local)
 * @param {string} outputPath  - output MP4 path
 * @param {number} durationSec - max duration (default 8)
 * @returns {Promise<string>}  output path
 */
async function muxAudioIntoVideo(videoPath, audioPath, outputPath, durationSec = 8) {
  ensureFfmpegAvailable();

  console.log(`[FFMPEG] Muxing audio into video (${durationSec}s)`);
  console.log(`[FFMPEG]   video: ${path.basename(videoPath)}`);
  console.log(`[FFMPEG]   audio: ${path.basename(audioPath)}`);

  await runFfmpeg([
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-t', String(durationSec),
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ]);

  console.log(`[FFMPEG] Muxed output: ${path.basename(outputPath)}`);
  return outputPath;
}

module.exports = {
  ensureFfmpegAvailable,
  processVideo,
  muxAudioIntoVideo,
  downloadToFile,
  safeDelete,
};
