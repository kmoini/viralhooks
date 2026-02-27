// ──────────────────────────────────────────────────
// Video post-processor: download + letterbox to 9:16
//
// Controlled by POSTPROCESS_MODE env var:
//   "OFF"            → skip entirely, return raw Runway URL
//   "LETTERBOX_916"  → fit full frame into 720×1280 with padding
// ──────────────────────────────────────────────────
const { spawn }  = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const https      = require('https');
const http       = require('http');
const fs         = require('fs');
const path       = require('path');

// ── Download a URL to a local file ───────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(destPath);

    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }

      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
      file.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(destPath); } catch (_) {}
      reject(err);
    });
  });
}

// ── Run ffmpeg via spawn, return Promise ──────────
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`[FFMPEG] Running: ${path.basename(ffmpegPath)} ${args.join(' ')}`);

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// ── Letterbox video to exactly 720×1280 ──────────
// -noautorotate: prevents ffmpeg from auto-rotating based on metadata
// setsar=1: forces square pixels (no aspect ratio distortion)
// -metadata:s:v:0 rotate=0: clears rotation metadata
async function letterboxTo916(inputPath, outputPath) {
  const vf = 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1';

  // Try with audio copy first
  try {
    await runFfmpeg([
      '-noautorotate',
      '-i', inputPath,
      '-vf', vf,
      '-metadata:s:v:0', 'rotate=0',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-movflags', '+faststart',
      '-c:a', 'copy',
      '-y',
      outputPath,
    ]);
    console.log('[FFMPEG] Letterbox succeeded (with audio)');
    return outputPath;
  } catch (_) {
    console.log('[FFMPEG] Retrying without audio...');
  }

  // Fallback: no audio
  await runFfmpeg([
    '-noautorotate',
    '-i', inputPath,
    '-vf', vf,
    '-metadata:s:v:0', 'rotate=0',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-movflags', '+faststart',
    '-an',
    '-y',
    outputPath,
  ]);
  console.log('[FFMPEG] Letterbox succeeded (no audio)');
  return outputPath;
}

// ── Full pipeline: download → letterbox → cleanup ─
async function postprocessVideo(videoUrl, rawPath, outputPath) {
  console.log('[POSTPROCESS] Downloading Runway video...');
  await downloadFile(videoUrl, rawPath);
  console.log(`[POSTPROCESS] Downloaded -> ${path.basename(rawPath)}`);

  console.log('[POSTPROCESS] Letterboxing to 720x1280...');
  await letterboxTo916(rawPath, outputPath);
  console.log(`[POSTPROCESS] Done -> ${path.basename(outputPath)}`);

  // Clean up raw download
  try { fs.unlinkSync(rawPath); } catch (_) {}

  return outputPath;
}

module.exports = { postprocessVideo };
