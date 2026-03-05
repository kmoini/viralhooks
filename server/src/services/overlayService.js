// ──────────────────────────────────────────────────
// Overlay Service — Burns text + emoji onto video
// using FFmpeg drawtext filters.
//
// Input:  video URL + overlay template + custom text
// Output: Cloudinary URL of the overlayed MP4
// ──────────────────────────────────────────────────
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('../lib/cloudinary');
const { getOverlayTemplate } = require('../constants/overlayTemplates');

// Temp directory for overlay processing
const tmpDir = path.join(__dirname, '..', '..', 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// ── Font paths ──────────────────────────────────
// Use system Arial on Windows (guaranteed to exist and work with drawtext).
// Fall back to other system fonts on macOS / Linux.
function findFont() {
  const candidates = [
    'C:/Windows/Fonts/arialbd.ttf',                            // Windows — Arial Bold
    'C:/Windows/Fonts/arial.ttf',                               // Windows — Arial
    '/System/Library/Fonts/Helvetica.ttc',                      // macOS
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',    // Linux
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[OVERLAYS] Font found: ${p}`);
      return p;
    }
  }
  throw new Error('[OVERLAYS] No usable font found for drawtext');
}

const FONT_PATH = findFont();

// ── FFmpeg drawtext escaping ────────────────────
// FFmpeg drawtext text= values need specific escaping.
// Rules: escape ' : \ and replace % with %%. Newlines → space.
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')     // \ → \\
    .replace(/'/g, "'\\\\'")    // ' → '\\' (end quote, escaped quote, start quote)
    .replace(/:/g, '\\:')       // : → \:
    .replace(/%/g, '%%')        // % → %%
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

// ── Placement → x/y expressions ─────────────────
const PLACEMENT_TEXT = {
  top_center:    { x: '(w-text_w)/2',    y: 'h*0.105' },
  bottom_center: { x: '(w-text_w)/2',    y: 'h*0.80' },
  top_left:      { x: 'w*0.06',          y: 'h*0.105' },
  top_right:     { x: 'w*0.94-text_w',   y: 'h*0.105' },
  bottom_right:  { x: 'w*0.92-text_w',   y: 'h*0.80' },
};

// Drawbox pill background position per placement
const PLACEMENT_BOX = {
  top_center:    { x: 'iw*0.08', y: 'ih*0.075', w: 'iw*0.84', h: 'ih*0.08' },
  bottom_center: { x: 'iw*0.08', y: 'ih*0.775', w: 'iw*0.84', h: 'ih*0.08' },
  top_left:      { x: 'iw*0.03', y: 'ih*0.075', w: 'iw*0.60', h: 'ih*0.08' },
  top_right:     { x: 'iw*0.37', y: 'ih*0.075', w: 'iw*0.60', h: 'ih*0.08' },
  bottom_right:  { x: 'iw*0.37', y: 'ih*0.775', w: 'iw*0.60', h: 'ih*0.08' },
};

// Emoji goes near a corner depending on text placement
const PLACEMENT_EMOJI = {
  top_center:    { x: 'w*0.05',          y: 'h*0.08' },
  bottom_center: { x: 'w*0.90-text_w',   y: 'h*0.85' },
  top_left:      { x: 'w*0.05',          y: 'h*0.06' },
  top_right:     { x: 'w*0.94-text_w',   y: 'h*0.06' },
  bottom_right:  { x: 'w*0.90-text_w',   y: 'h*0.85' },
};

// ── Run ffmpeg ──────────────────────────────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const cmdStr = `ffmpeg ${args.join(' ')}`;
    console.log(`[OVERLAYS-FFMPEG] Running: ${cmdStr}`);

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[OVERLAYS-FFMPEG] Success (exit 0)');
        resolve();
      } else {
        console.error(`[OVERLAYS-FFMPEG] FAILED (exit ${code})`);
        console.error(`[OVERLAYS-FFMPEG] stderr tail:\n${stderr.slice(-600)}`);
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr.slice(-600)}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// ── Download URL to temp file ───────────────────
async function downloadToTemp(url) {
  const filename = `overlay_in_${crypto.randomUUID()}.mp4`;
  const outPath = path.join(tmpDir, filename);

  console.log(`[OVERLAYS] Downloading video to ${filename}...`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[OVERLAYS] Download failed: ${res.status} ${res.statusText}`);
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

  const stat = fs.statSync(outPath);
  console.log(`[OVERLAYS] Downloaded ${(stat.size / 1024 / 1024).toFixed(1)} MB`);

  return outPath;
}

// ── Safe delete ─────────────────────────────────
function safeDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`[OVERLAYS] Could not delete ${filePath}: ${err.message}`);
  }
}

// ── Build drawtext filter ───────────────────────
function buildOverlayFilter(template, text) {
  // Escape font path for FFmpeg (forward slashes, escape colons)
  const fontPath = FONT_PATH.replace(/\\/g, '/').replace(/:/g, '\\:');

  const placement = template.placement || 'top_center';
  const textPos = PLACEMENT_TEXT[placement] || PLACEMENT_TEXT.top_center;
  const emojiPos = PLACEMENT_EMOJI[placement] || PLACEMENT_EMOJI.top_center;

  const escapedText = escapeDrawtext(text);
  const boxPos = PLACEMENT_BOX[placement] || PLACEMENT_BOX.top_center;

  const filters = [];

  // Layer 0: Semi-transparent pill background behind text (TikTok-style)
  filters.push(
    `drawbox=x=${boxPos.x}` +
    `:y=${boxPos.y}` +
    `:w=${boxPos.w}` +
    `:h=${boxPos.h}` +
    `:color=black@0.35` +
    `:t=fill`
  );

  // Layer 1: Caption text — h*0.055 fontsize, borderw=5
  filters.push(
    `drawtext=text='${escapedText}'` +
    `:fontfile='${fontPath}'` +
    `:fontsize=h*0.055` +
    `:fontcolor=white` +
    `:borderw=5` +
    `:bordercolor=black` +
    `:x=${textPos.x}` +
    `:y=${textPos.y}`
  );

  // Layer 2: Emoji "sticker" — uses Segoe UI Emoji on Windows
  const emojiFontCandidates = [
    'C:/Windows/Fonts/seguiemj.ttf',                          // Windows 10/11
    '/System/Library/Fonts/Apple Color Emoji.ttc',             // macOS
    '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',       // Linux
  ];

  let emojiFont = null;
  for (const candidate of emojiFontCandidates) {
    if (fs.existsSync(candidate)) {
      emojiFont = candidate.replace(/\\/g, '/').replace(/:/g, '\\:');
      break;
    }
  }

  if (emojiFont) {
    const escapedEmoji = escapeDrawtext(template.emoji || '');
    filters.push(
      `drawtext=text='${escapedEmoji}'` +
      `:fontfile='${emojiFont}'` +
      `:fontsize=h*0.08` +
      `:fontcolor=white` +
      `:borderw=3` +
      `:bordercolor=black` +
      `:x=${emojiPos.x}` +
      `:y=${emojiPos.y}`
    );
  } else {
    console.warn('[OVERLAYS] No emoji font found — emoji layer skipped');
  }

  const filterStr = filters.join(',');
  console.log(`[OVERLAYS] Filter: ${filterStr}`);
  return filterStr;
}

// ── Main: render video with overlay ─────────────
async function renderVideoWithOverlay(videoUrl, overlayTemplateId, text) {
  console.log('');
  console.log('========================================');
  console.log('[OVERLAYS] *** OVERLAY RENDER START ***');
  console.log(`[OVERLAYS] incoming: template=${overlayTemplateId}, text="${text}", videoUrl=${videoUrl.slice(0, 80)}...`);
  console.log('========================================');

  const template = getOverlayTemplate(overlayTemplateId);
  if (!template) {
    throw new Error(`[OVERLAYS] Unknown overlay template: ${overlayTemplateId}`);
  }

  // 1) Download video to temp
  const inputPath = await downloadToTemp(videoUrl);
  const outputFilename = `overlay_out_${crypto.randomUUID()}.mp4`;
  const outputPath = path.join(tmpDir, outputFilename);

  try {
    // 2) Build drawtext filter
    const filterStr = buildOverlayFilter(template, text);

    // 3) Run FFmpeg
    const ffmpegArgs = [
      '-i', inputPath,
      '-vf', filterStr,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ];

    await runFfmpeg(ffmpegArgs);

    // Verify output exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('[OVERLAYS] FFmpeg produced no output file');
    }
    const outStat = fs.statSync(outputPath);
    console.log(`[OVERLAYS] Output: ${outputFilename} (${(outStat.size / 1024 / 1024).toFixed(1)} MB)`);

    // 4) Upload to Cloudinary
    console.log('[OVERLAYS] Uploading to Cloudinary...');
    const result = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'snapdance/overlays',
      public_id: `overlay_${crypto.randomUUID()}`,
    });

    console.log(`[OVERLAYS] Uploaded -> ${result.secure_url}`);
    console.log('[OVERLAYS] *** OVERLAY RENDER COMPLETE ***');
    console.log('');

    return result.secure_url;
  } finally {
    // 5) Cleanup temp files
    safeDelete(inputPath);
    safeDelete(outputPath);
    console.log('[OVERLAYS] Temp files cleaned up');
  }
}

module.exports = { renderVideoWithOverlay };
