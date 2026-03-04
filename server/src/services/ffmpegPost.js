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

// ── Ping-pong loop for TikTok (fwd+rev ×2 ≈ 32s) ──
/**
 * Build a 32-second ping-pong loop from an 8-second clip:
 *   A (forward) → B (reverse) → C (forward) → D (reverse)
 *
 * Because each boundary shares the same frame (end of fwd =
 * start of rev, and vice-versa) the direction switch is
 * inherently seamless. A 0.15s xfade softens it further.
 *
 * Filter graph:
 *   split=4 → trim+setpts each (reverse on B,D) →
 *   xfade chain (3 × 0.15s) → tpad + trim to 32.0s
 *
 * Total before pad: 4×8 − 3×0.15 = 31.55s
 * tpad clones last frame → trim to exactly 32s
 *
 * @param {string} inputPath  - path to the 8s source MP4
 * @param {string} outputPath - path for the 32s output MP4
 * @returns {Promise<string>} outputPath
 */
async function loopVideoForTikTok(inputPath, outputPath) {
  ensureFfmpegAvailable();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  console.log('[FFMPEG] Ping-pong looping to 32s (forward+reverse)');

  const CLIP_DUR = 8;
  const XFADE_DUR = 0.15;

  // 1) Split input into 4 copies
  const filters = [
    '[0:v]split=4[v0][v1][v2][v3]',
  ];

  // 2) Trim + normalize each; reverse segments B (v1) and D (v3)
  //    Pattern: fwd, rev, fwd, rev
  const segLabels = ['seg0', 'seg1', 'seg2', 'seg3'];
  const isReverse = [false, true, false, true];

  for (let i = 0; i < 4; i++) {
    const rev = isReverse[i] ? ',reverse,setpts=PTS-STARTPTS' : '';
    filters.push(
      `[v${i}]trim=0:${CLIP_DUR},setpts=PTS-STARTPTS${rev}[${segLabels[i]}]`
    );
  }

  // 3) Chain xfade transitions between segments
  //    Offsets: seam at 8s → offset 7.85, output ~15.85s
  //             seam at 15.85s → offset 15.70, output ~23.70s
  //             seam at 23.70s → offset 23.55, output ~31.55s
  let runningDur = CLIP_DUR;
  let prevLabel = segLabels[0];

  for (let i = 1; i < segLabels.length; i++) {
    const offset = (runningDur - XFADE_DUR).toFixed(2);
    const outLabel = i < segLabels.length - 1 ? `x${i}` : 'xfinal';
    filters.push(
      `[${prevLabel}][${segLabels[i]}]xfade=transition=fade:duration=${XFADE_DUR}:offset=${offset}[${outLabel}]`
    );
    runningDur = runningDur + CLIP_DUR - XFADE_DUR;
    prevLabel = outLabel;
  }

  // 4) Pad to fill the 0.45s gap, then hard-trim to exactly 32s
  filters.push(
    `[${prevLabel}]tpad=stop_mode=clone:stop_duration=1,trim=0:32,setpts=PTS-STARTPTS[vout]`
  );

  const filterGraph = filters.join(';');

  await runFfmpeg([
    '-i', inputPath,
    '-filter_complex', filterGraph,
    '-map', '[vout]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-an',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ]);

  console.log('[FFMPEG] Ping-pong loop complete');
  return outputPath;
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
  loopVideoForTikTok,
  muxAudioIntoVideo,
  downloadToFile,
  safeDelete,
};
