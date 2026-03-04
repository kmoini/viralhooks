/**
 * BPM Detection Service — lightweight energy-based autocorrelation.
 * Converts audio to raw PCM via ffmpeg, then estimates tempo.
 * Fallback: 105 BPM if detection fails.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const SAMPLE_RATE = 44100;
const WINDOW_SIZE = 1024;
const HOP_SIZE = 512;
const MIN_BPM = 60;
const MAX_BPM = 180;
const PREFERRED_MIN = 80;
const PREFERRED_MAX = 140;
const FALLBACK_BPM = 105;

/**
 * Run ffmpeg with given args. Returns promise.
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`));
    });
    proc.on('error', (err) => reject(err));
  });
}

/**
 * Convert audio file to raw float32 mono PCM at 44.1kHz.
 * @param {string} inputPath
 * @returns {Promise<string>} path to raw PCM file
 */
async function convertToRawPCM(inputPath) {
  const outputPath = inputPath + '.raw';
  await runFfmpeg([
    '-i', inputPath,
    '-f', 'f32le',
    '-ac', '1',
    '-ar', String(SAMPLE_RATE),
    '-y', outputPath,
  ]);
  return outputPath;
}

/**
 * Read raw PCM file as Float32Array.
 */
function readPCM(filePath) {
  const buffer = fs.readFileSync(filePath);
  // Create a properly aligned Float32Array
  const aligned = Buffer.alloc(buffer.length);
  buffer.copy(aligned);
  return new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4);
}

/**
 * Compute energy envelope from samples.
 */
function computeEnergy(samples) {
  const numFrames = Math.floor((samples.length - WINDOW_SIZE) / HOP_SIZE);
  if (numFrames < 2) return new Float32Array(0);

  const energy = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const offset = i * HOP_SIZE;
    for (let j = 0; j < WINDOW_SIZE; j++) {
      const s = samples[offset + j];
      sum += s * s;
    }
    energy[i] = sum / WINDOW_SIZE;
  }
  return energy;
}

/**
 * Compute onset detection function (half-wave rectified first difference).
 */
function computeOnsets(energy) {
  const onsets = new Float32Array(energy.length);
  for (let i = 1; i < energy.length; i++) {
    const diff = energy[i] - energy[i - 1];
    onsets[i] = diff > 0 ? diff : 0;
  }
  return onsets;
}

/**
 * Normalized autocorrelation of onset signal.
 */
function autocorrelate(signal, minLag, maxLag) {
  const correlation = new Float32Array(maxLag - minLag + 1);
  // Normalization factor
  let norm = 0;
  for (let i = 0; i < signal.length; i++) {
    norm += signal[i] * signal[i];
  }
  if (norm === 0) return correlation;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < signal.length - lag; i++) {
      sum += signal[i] * signal[i + lag];
    }
    correlation[lag - minLag] = sum / norm;
  }
  return correlation;
}

/**
 * Find the BPM from autocorrelation peaks.
 * Also checks half/double time to prefer the dance-friendly range.
 */
function findBPMFromCorrelation(correlation, minLag) {
  let maxVal = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < correlation.length; i++) {
    if (correlation[i] > maxVal) {
      maxVal = correlation[i];
      maxIdx = i;
    }
  }

  if (maxVal <= 0) return null;

  const peakLag = minLag + maxIdx;
  let bpm = (60 * SAMPLE_RATE) / (peakLag * HOP_SIZE);

  // Octave correction: prefer 80-140 range (typical dance music)
  if (bpm > PREFERRED_MAX && bpm / 2 >= PREFERRED_MIN) {
    bpm = bpm / 2;
  } else if (bpm < PREFERRED_MIN && bpm * 2 <= PREFERRED_MAX) {
    bpm = bpm * 2;
  }

  return Math.round(bpm);
}

/**
 * Safely delete a file.
 */
function safeDelete(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
}

/**
 * Detect BPM from an audio file.
 * @param {string} audioPath — path to audio file (mp3, m4a, wav, etc.)
 * @returns {Promise<{bpm: number, detected: boolean}>}
 */
async function detectBPM(audioPath) {
  let rawPath = null;
  try {
    // Check file exists and has reasonable size
    const stat = fs.statSync(audioPath);
    if (stat.size < 1000) {
      console.warn('[BPM] Audio file too small, using fallback');
      return { bpm: FALLBACK_BPM, detected: false };
    }

    // Convert to raw PCM
    rawPath = await convertToRawPCM(audioPath);
    const samples = readPCM(rawPath);
    safeDelete(rawPath);
    rawPath = null;

    // Need at least 2 seconds of audio for reliable detection
    const minSamples = SAMPLE_RATE * 2;
    if (samples.length < minSamples) {
      console.warn('[BPM] Audio too short for BPM detection, using fallback');
      return { bpm: FALLBACK_BPM, detected: false };
    }

    // Compute energy and onset envelope
    const energy = computeEnergy(samples);
    if (energy.length < 10) {
      return { bpm: FALLBACK_BPM, detected: false };
    }

    const onsets = computeOnsets(energy);

    // Autocorrelation lags for BPM range
    const minLag = Math.floor((60 * SAMPLE_RATE) / (MAX_BPM * HOP_SIZE));
    const maxLag = Math.ceil((60 * SAMPLE_RATE) / (MIN_BPM * HOP_SIZE));

    const correlation = autocorrelate(onsets, minLag, maxLag);
    const bpm = findBPMFromCorrelation(correlation, minLag);

    if (bpm && bpm >= MIN_BPM && bpm <= MAX_BPM) {
      console.log(`[BPM] Detected: ${bpm} BPM`);
      return { bpm, detected: true };
    }

    console.warn('[BPM] Detection out of range, using fallback');
    return { bpm: FALLBACK_BPM, detected: false };
  } catch (err) {
    console.error('[BPM] Detection failed:', err.message);
    if (rawPath) safeDelete(rawPath);
    return { bpm: FALLBACK_BPM, detected: false };
  }
}

module.exports = { detectBPM, FALLBACK_BPM };
