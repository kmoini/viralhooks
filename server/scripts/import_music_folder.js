#!/usr/bin/env node

/**
 * import_music_folder.js — Batch-import MP3 files into the SnapDance music catalog.
 *
 * Usage:
 *   node server/scripts/import_music_folder.js <folder_path>
 *
 * For each .mp3 file found in <folder_path>:
 *   1. Skip if a catalog entry with the same title already exists
 *   2. Detect BPM using bpmService
 *   3. Get duration via ffmpeg
 *   4. Upload to Cloudinary (resource_type: 'video')
 *   5. Append entry to musicCatalog.json
 *
 * Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { detectBPM } = require('../src/services/bpmService');
const { uploadAudioToCloudinary, getAudioDuration } = require('../src/services/audioService');

const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'musicCatalog.json');

/**
 * Derive a human-readable title from a filename.
 * "hip-hop_groove_v2.mp3" → "Hip Hop Groove V2"
 */
function titleFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Parse the next musicId number from existing entries.
 * e.g. if last entry is "cat_010" → returns 11.
 */
function getNextIdNumber(catalog) {
  let max = 0;
  for (const entry of catalog) {
    const match = entry.musicId.match(/^cat_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
}

function formatId(num) {
  return `cat_${String(num).padStart(3, '0')}`;
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error('Usage: node import_music_folder.js <folder_path>');
    process.exit(1);
  }

  const folder = path.resolve(folderArg);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.error(`Error: "${folder}" is not a valid directory.`);
    process.exit(1);
  }

  // Verify Cloudinary env vars
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('Error: Missing CLOUDINARY env vars in server/.env');
    process.exit(1);
  }

  // Load existing catalog
  let catalog = [];
  if (fs.existsSync(CATALOG_PATH)) {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
  }

  // Build set of existing titles (lowercase) for dedup
  const existingTitles = new Set(catalog.map((e) => e.title.toLowerCase()));

  // Find all .mp3 files
  const files = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.mp3')).sort();
  if (files.length === 0) {
    console.log('No .mp3 files found in', folder);
    process.exit(0);
  }

  console.log(`Found ${files.length} MP3 file(s) in ${folder}`);
  console.log(`Existing catalog has ${catalog.length} entries.\n`);

  let nextNum = getNextIdNumber(catalog);
  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const title = titleFromFilename(file);
    const filePath = path.join(folder, file);

    // Duplicate check
    if (existingTitles.has(title.toLowerCase())) {
      console.log(`SKIP (duplicate title): ${file} → "${title}"`);
      skipped++;
      continue;
    }

    console.log(`[${imported + 1}] Processing: ${file} → "${title}"`);

    try {
      // Step 1: Detect BPM
      console.log('  Detecting BPM...');
      const { bpm, detected: bpmDetected } = await detectBPM(filePath);
      console.log(`  BPM: ${bpm} (${bpmDetected ? 'detected' : 'fallback'})`);

      // Step 2: Get duration
      console.log('  Getting duration...');
      const durationSec = Math.round(await getAudioDuration(filePath));
      console.log(`  Duration: ${durationSec}s`);

      // Step 3: Upload to Cloudinary
      console.log('  Uploading to Cloudinary...');
      const audioUrl = await uploadAudioToCloudinary(filePath, file);
      console.log(`  URL: ${audioUrl}`);

      // Step 4: Create catalog entry
      const musicId = formatId(nextNum);
      const entry = {
        musicId,
        source: 'catalog',
        title,
        artist: 'Unknown',
        previewUrl: audioUrl,
        audioUrl,
        bpm,
        bpmDetected,
        durationSec,
        createdAt: new Date().toISOString(),
      };

      catalog.push(entry);
      existingTitles.add(title.toLowerCase());
      nextNum++;
      imported++;

      console.log(`  → Added as ${musicId}\n`);
    } catch (err) {
      console.error(`  ERROR processing ${file}: ${err.message}\n`);
    }
  }

  // Write updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');

  console.log('---');
  console.log(`Done. Imported: ${imported}, Skipped: ${skipped}, Total catalog: ${catalog.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
