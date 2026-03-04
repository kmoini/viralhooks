/**
 * Music Store — in-memory cache with disk persistence.
 * Loads catalog entries on startup, persists user uploads/extracts to musicStore.json.
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'data', 'musicCatalog.json');
const STORE_PATH = path.join(__dirname, '..', 'data', 'musicStore.json');

/** @type {Map<string, MusicEntry>} */
const store = new Map();

/**
 * @typedef {Object} MusicEntry
 * @property {string} musicId
 * @property {'catalog'|'upload'|'extract'} source
 * @property {string} title
 * @property {string} artist
 * @property {string} previewUrl
 * @property {string} audioUrl
 * @property {number} bpm
 * @property {boolean} bpmDetected
 * @property {number} [durationSec]
 * @property {string} createdAt
 */

function loadCatalog() {
  try {
    const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
    const entries = JSON.parse(raw);
    for (const entry of entries) {
      store.set(entry.musicId, entry);
    }
    console.log(`[MUSIC] Loaded ${entries.length} catalog entries`);
  } catch (err) {
    console.warn('[MUSIC] Could not load catalog:', err.message);
  }
}

function loadPersistedStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const entries = JSON.parse(raw);
      for (const entry of entries) {
        store.set(entry.musicId, entry);
      }
      console.log(`[MUSIC] Loaded ${entries.length} persisted entries`);
    }
  } catch (err) {
    console.warn('[MUSIC] Could not load persisted store:', err.message);
  }
}

function persist() {
  try {
    // Only persist non-catalog entries (uploads + extracts)
    const userEntries = [];
    for (const entry of store.values()) {
      if (entry.source !== 'catalog') {
        userEntries.push(entry);
      }
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(userEntries, null, 2), 'utf-8');
    console.log(`[MUSIC] Persisted ${userEntries.length} user entries`);
  } catch (err) {
    console.error('[MUSIC] Persist failed:', err.message);
  }
}

/** @returns {MusicEntry[]} */
function list() {
  return Array.from(store.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** @param {string} id @returns {MusicEntry|null} */
function get(id) {
  return store.get(id) || null;
}

/** @param {MusicEntry} entry */
function upsert(entry) {
  store.set(entry.musicId, entry);
  persist();
  console.log(`[MUSIC] Upserted ${entry.musicId} (${entry.source})`);
  return entry;
}

// Initialize on require
loadCatalog();
loadPersistedStore();

module.exports = { list, get, upsert, persist };
