#!/usr/bin/env node
// ──────────────────────────────────────────────────
// Test script for the viral render pipeline
//
// Usage:
//   node scripts/testViralRender.js                   # test matching + timing only
//   node scripts/testViralRender.js --ffmpeg test.mp4  # also test FFmpeg processing
//
// The matching test runs without any server or API.
// The FFmpeg test requires ffmpeg-static to be installed
// (npm install in server/).
// ──────────────────────────────────────────────────
const path = require('path');

// ── Load modules relative to server/ ──
const soundMatchPath = path.join(__dirname, '..', 'server', 'src', 'services', 'soundMatch.js');
const ffmpegPostPath = path.join(__dirname, '..', 'server', 'src', 'services', 'ffmpegPost.js');
const viralTemplatesPath = path.join(__dirname, '..', 'server', 'src', 'data', 'viralTemplates.js');
const trendingSoundsPath = path.join(__dirname, '..', 'server', 'src', 'data', 'trendingSounds.json');

console.log('');
console.log('=== SnapDance Viral Render — Test Script ===');
console.log('');

// ── Test 1: Load data files ──
console.log('── Test 1: Load data files ──');
let trendingSounds, viralTemplates;
try {
  trendingSounds = require(trendingSoundsPath);
  console.log(`  Loaded ${trendingSounds.length} trending sounds`);

  const { VIRAL_TEMPLATES } = require(viralTemplatesPath);
  viralTemplates = VIRAL_TEMPLATES;
  console.log(`  Loaded ${viralTemplates.length} viral templates`);
  console.log('  PASS');
} catch (err) {
  console.error(`  FAIL: ${err.message}`);
  process.exit(1);
}

// ── Test 2: Sound matching ──
console.log('');
console.log('── Test 2: Sound matching ──');
const { pickTrendingSound, pickBestTemplateForSound, computeTimingPlan } = require(soundMatchPath);

// Test picking sounds by energy type
for (const energy of ['hype', 'smooth', 'meme']) {
  const sound = pickTrendingSound({ region: 'CA', energyType: energy });
  if (!sound) {
    console.error(`  FAIL: No sound found for energy="${energy}"`);
    process.exit(1);
  }
  console.log(`  [${energy}] Picked: "${sound.soundName}" (${sound.bpm} BPM)`);
}

// Test picking without energy filter
const anySound = pickTrendingSound({ region: 'CA' });
console.log(`  [any]   Picked: "${anySound.soundName}" (${anySound.bpm} BPM)`);
console.log('  PASS');

// ── Test 3: Template matching for each sound ──
console.log('');
console.log('── Test 3: Template matching ──');
for (const sound of trendingSounds) {
  const template = pickBestTemplateForSound(sound);
  const bpmDelta = Math.abs(sound.bpm - template.baseBpm);
  const match = template.energyType === sound.energyType ? 'exact' : 'cross';
  console.log(
    `  "${sound.soundName}" (${sound.bpm} BPM ${sound.energyType}) ` +
    `-> "${template.name}" (${template.baseBpm} BPM ${template.energyType}) ` +
    `[delta=${bpmDelta}, ${match}]`
  );
}
console.log('  PASS');

// ── Test 4: Timing plans ──
console.log('');
console.log('── Test 4: Timing plans ──');
const testCases = [
  { bpm: 106, drop: 2.1, energy: 'hype' },
  { bpm: 92,  drop: 3.2, energy: 'smooth' },
  { bpm: 88,  drop: 1.0, energy: 'meme' },
  { bpm: 120, drop: 1.2, energy: 'hype' },
  { bpm: 125, drop: 1.0, energy: 'hype' },  // tests clamping
];

for (const tc of testCases) {
  const sound = { bpm: tc.bpm, dropTimeSec: tc.drop, energyType: tc.energy };
  const template = pickBestTemplateForSound(sound);
  const plan = computeTimingPlan(sound, template);

  console.log(`  Sound ${tc.bpm} BPM (${tc.energy}) + Template ${template.baseBpm} BPM:`);
  console.log(`    speed=${plan.speedFactor}, hold=${plan.leadHoldSec}s, clamped=${plan.clamped}`);

  // Validate bounds
  if (plan.speedFactor < 0.88 || plan.speedFactor > 1.12) {
    console.error(`    FAIL: speedFactor ${plan.speedFactor} out of [0.88, 1.12]`);
    process.exit(1);
  }
  if (plan.leadHoldSec < 0) {
    console.error(`    FAIL: leadHoldSec ${plan.leadHoldSec} is negative`);
    process.exit(1);
  }
}
console.log('  PASS');

// ── Test 5: FFmpeg (optional) ──
const ffmpegArgIdx = process.argv.indexOf('--ffmpeg');
if (ffmpegArgIdx !== -1 && process.argv[ffmpegArgIdx + 1]) {
  const inputVideo = path.resolve(process.argv[ffmpegArgIdx + 1]);
  console.log('');
  console.log('── Test 5: FFmpeg post-processing ──');
  console.log(`  Input: ${inputVideo}`);

  const fs = require('fs');
  if (!fs.existsSync(inputVideo)) {
    console.error(`  FAIL: Input file not found: ${inputVideo}`);
    process.exit(1);
  }

  const { ensureFfmpegAvailable, processVideo } = require(ffmpegPostPath);

  try {
    ensureFfmpegAvailable();
    console.log('  FFmpeg binary: OK');
  } catch (err) {
    console.error(`  FAIL: ${err.message}`);
    process.exit(1);
  }

  // Run FFmpeg with a sample timing plan
  const testSound = pickTrendingSound({ region: 'CA', energyType: 'hype' });
  const testTemplate = pickBestTemplateForSound(testSound);
  const testPlan = computeTimingPlan(testSound, testTemplate);

  console.log(`  Processing with: speed=${testPlan.speedFactor}, hold=${testPlan.leadHoldSec}s`);

  processVideo({
    inputPath: inputVideo,
    speedFactor: testPlan.speedFactor,
    leadHoldSec: testPlan.leadHoldSec,
    targetDurationSec: testPlan.targetDurationSec,
    loopToSec: 24,
  })
    .then((outputPath) => {
      console.log(`  Output: ${outputPath}`);
      const stats = fs.statSync(outputPath);
      console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
      console.log('  PASS');
      console.log('');
      console.log('=== All tests passed ===');
    })
    .catch((err) => {
      console.error(`  FAIL: ${err.message}`);
      process.exit(1);
    });
} else {
  console.log('');
  console.log('── Test 5: FFmpeg (skipped — no --ffmpeg flag) ──');
  console.log('  To test FFmpeg, run:');
  console.log('    node scripts/testViralRender.js --ffmpeg path/to/sample.mp4');
  console.log('');
  console.log('=== All matching tests passed ===');
}
