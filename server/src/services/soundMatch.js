// ──────────────────────────────────────────────────
// Sound-matching service
//
// Picks a trending sound, finds the best template,
// and computes an FFmpeg timing plan for beat sync.
// ──────────────────────────────────────────────────
const path = require('path');
const { VIRAL_TEMPLATES } = require('../data/viralTemplates');

// Load trending sounds from JSON (static file, no DB yet)
const trendingSounds = require(path.join(__dirname, '../data/trendingSounds.json'));

// ── Helpers ─────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ── Pick a trending sound ───────────────────────
/**
 * Choose a trending sound filtered by region and optional energyType.
 * Returns the most recently updated match.
 *
 * @param {{ region?: string, energyType?: string }} options
 * @returns {object} a sound object from trendingSounds.json
 */
function pickTrendingSound({ region, energyType } = {}) {
  let pool = trendingSounds;

  // Filter by region if specified
  if (region) {
    const regionFiltered = pool.filter((s) => s.region === region);
    if (regionFiltered.length > 0) pool = regionFiltered;
  }

  // Filter by energyType if specified
  if (energyType) {
    const energyFiltered = pool.filter((s) => s.energyType === energyType);
    if (energyFiltered.length > 0) pool = energyFiltered;
  }

  // Sort by updatedAt descending (most recent first)
  pool.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // Return the most recently updated sound
  return pool[0];
}

// ── Pick best template for a sound ──────────────
/**
 * Choose the template that best matches a sound's BPM and energy.
 *
 * Strategy:
 *   1) Prefer same energyType with closest BPM
 *   2) If BPM delta > 18 for all same-energy templates, use closest BPM regardless
 *
 * @param {object} sound - a sound from trendingSounds.json
 * @returns {object} a template from viralTemplates.js
 */
function pickBestTemplateForSound(sound) {
  const MAX_BPM_DELTA = 18;

  // Score each template: lower is better
  function score(template) {
    const bpmDelta = Math.abs(sound.bpm - template.baseBpm);
    const sameEnergy = template.energyType === sound.energyType;
    // Same energy gets a 0 bonus; different energy gets +100 penalty
    return bpmDelta + (sameEnergy ? 0 : 100);
  }

  // Sort by score (lowest first)
  const sorted = [...VIRAL_TEMPLATES].sort((a, b) => score(a) - score(b));

  // Check if the best same-energy match has acceptable BPM delta
  const bestSameEnergy = sorted.find((t) => t.energyType === sound.energyType);
  if (bestSameEnergy && Math.abs(sound.bpm - bestSameEnergy.baseBpm) <= MAX_BPM_DELTA) {
    return bestSameEnergy;
  }

  // Fall back to closest BPM regardless of energy
  const closestBpm = [...VIRAL_TEMPLATES].sort(
    (a, b) => Math.abs(sound.bpm - a.baseBpm) - Math.abs(sound.bpm - b.baseBpm)
  );

  return closestBpm[0];
}

// ── Compute timing plan ─────────────────────────
/**
 * Given a sound and a template, compute the FFmpeg timing adjustments.
 *
 * @param {object} sound    - from trendingSounds.json
 * @param {object} template - from viralTemplates.js
 * @returns {object} timing plan for FFmpeg
 */
function computeTimingPlan(sound, template) {
  const minFactor = 1 - template.maxRetimingPercent; // 0.88
  const maxFactor = 1 + template.maxRetimingPercent; // 1.12

  // Speed factor: how much to speed up/slow down the video
  // If sound is faster than template, speed > 1 (video plays faster)
  const rawFactor = sound.bpm / template.baseBpm;
  const speedFactor = clamp(rawFactor, minFactor, maxFactor);

  // Lead-in hold: freeze first frame so the template's "big hit"
  // aligns with the sound's drop time
  const leadHoldSec = Math.max(0, sound.dropTimeSec - template.dropHitTimeSec);

  // Target duration is always 8s (the base clip before optional looping)
  const targetDurationSec = template.baseDurationSec;

  return {
    speedFactor: Math.round(speedFactor * 10000) / 10000,  // 4 decimal places
    leadHoldSec: Math.round(leadHoldSec * 100) / 100,      // 2 decimal places
    targetDurationSec,
    bpmDelta: Math.round((sound.bpm - template.baseBpm) * 100) / 100,
    clamped: rawFactor !== speedFactor,
  };
}

module.exports = {
  pickTrendingSound,
  pickBestTemplateForSound,
  computeTimingPlan,
};
