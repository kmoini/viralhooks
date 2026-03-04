// ──────────────────────────────────────────────────
// Viral-render dance templates (server-side only)
//
// Each template targets a BPM range + energy type.
// The server picks the best template for a given
// trending sound, then generates via Kling (10s raw)
// and post-processes to 8s with beat-matched timing.
//
// Provider duration is 10s so we have room to trim
// to 8s after speed adjustment + lead-in hold.
// ──────────────────────────────────────────────────

const VIRAL_MASTER_BASE_PROMPT =
  'Chest-up framing only (top of head to mid torso). ' +
  'Camera locked, no zoom, no rotation, no perspective change. ' +
  'Preserve identity, hair, beard, skin tone, clothing, background exactly. ' +
  'Motion only in shoulders, head, arms, hands, upper torso. ' +
  'Natural physics, no morphing, no warping, no identity drift. ' +
  'Lighting constant throughout. ' +
  'Loop: final pose matches starting pose seamlessly. ' +
  'Eyes engaged with camera, subtle eyebrow accents. ' +
  'Motion amplitude: medium TikTok realism.\n\n';

const VIRAL_TEMPLATES = [
  {
    templateId: 'viral_meme_slow_90',
    name: 'Slow Meme Groove',
    energyType: 'meme',
    baseBpm: 90,
    baseDurationSec: 8.0,
    dropHitTimeSec: 1.0,
    maxRetimingPercent: 0.12,
    providerDurationSec: 10,
    prompt:
      VIRAL_MASTER_BASE_PROMPT +
      'Laid-back meme groove at 90 BPM. ' +
      'Count 1-2: deadpan stare, single slow eyebrow raise. ' +
      'Count 3-4: minimal shoulder shrug, slight head tilt right. ' +
      'Count 5-6: slow exaggerated nod, small smirk forming. ' +
      'Count 7-8: both hands raise to chest height, palms up "really?" gesture. ' +
      'Count 9-12: gentle side-to-side head sway, shoulders drop, return to deadpan start. ' +
      'Keep it understated and comedic. Seamless loop.',
    kling: {
      prompt: null, // filled at runtime by combining VIRAL_MASTER_BASE_PROMPT + timing hints
      negativePrompt:
        'identity drift, face morphing, background change, camera movement, zoom, pan, fast motion, jitter, blur',
      duration: 10,
      aspectRatio: '9:16',
      mode: 'pro',
      cfgScale: 1.0,
      cameraControl: {
        type: 'simple',
        config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 },
      },
    },
  },

  {
    templateId: 'viral_smooth_95',
    name: 'Smooth Shoulder Sway',
    energyType: 'smooth',
    baseBpm: 95,
    baseDurationSec: 8.0,
    dropHitTimeSec: 1.5,
    maxRetimingPercent: 0.12,
    providerDurationSec: 10,
    prompt:
      VIRAL_MASTER_BASE_PROMPT +
      'Smooth flowing groove at 95 BPM. ' +
      'Count 1-2: gentle left shoulder roll forward, chin dip. ' +
      'Count 3-4: gentle right shoulder roll forward, slight head tilt. ' +
      'Count 5-6: both shoulders roll back simultaneously, chest lifts, subtle smile. ' +
      'Count 7-8: smooth wave from right hand to left hand at chest height. ' +
      'Count 9-12: gradual deceleration, shoulders settle, hands lower, eyes return to camera. ' +
      'Continuous flowing motion, no sharp stops. Seamless loop.',
    kling: {
      prompt: null,
      negativePrompt:
        'identity drift, face morphing, background change, camera movement, zoom, pan, jerky motion, jitter',
      duration: 10,
      aspectRatio: '9:16',
      mode: 'pro',
      cfgScale: 1.0,
      cameraControl: {
        type: 'simple',
        config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 },
      },
    },
  },

  {
    templateId: 'viral_hype_105',
    name: 'Hype Shoulder Pop',
    energyType: 'hype',
    baseBpm: 105,
    baseDurationSec: 8.0,
    dropHitTimeSec: 1.2,
    maxRetimingPercent: 0.12,
    providerDurationSec: 10,
    prompt:
      VIRAL_MASTER_BASE_PROMPT +
      'Energetic beat-mapped choreography at 105 BPM. ' +
      'Count 1-2: sharp right shoulder pop up then down. ' +
      'Count 3-4: sharp left shoulder pop up then down. ' +
      'Count 5-6: both shoulders roll back with chest lift, confident grin. ' +
      'Count 7-8: right hand point forward, head nod, eyebrow raise. ' +
      'Count 9-12: alternating shoulder bounces, hands wave at chest height, return to start. ' +
      'High energy, crisp hits. Seamless loop.',
    kling: {
      prompt: null,
      negativePrompt:
        'identity drift, face morphing, background change, camera movement, zoom, pan, jitter, blur',
      duration: 10,
      aspectRatio: '9:16',
      mode: 'pro',
      cfgScale: 1.0,
      cameraControl: {
        type: 'simple',
        config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 },
      },
    },
  },

  {
    templateId: 'viral_hype_112',
    name: 'Pop and Lock',
    energyType: 'hype',
    baseBpm: 112,
    baseDurationSec: 8.0,
    dropHitTimeSec: 1.4,
    maxRetimingPercent: 0.12,
    providerDurationSec: 10,
    prompt:
      VIRAL_MASTER_BASE_PROMPT +
      'Punchy pop-and-lock choreography at 112 BPM. ' +
      'Count 1-2: freeze pose, then sharp chest pop forward. ' +
      'Count 3-4: left arm extends out, wrist flick, head snaps right. ' +
      'Count 5-6: right arm extends out, wrist flick, head snaps left. ' +
      'Count 7-8: both arms pull in fast, double shoulder bounce. ' +
      'Count 9-12: rapid alternating arm waves, slowing to starting pose. ' +
      'Crisp isolations, sharp accents. Seamless loop.',
    kling: {
      prompt: null,
      negativePrompt:
        'identity drift, face morphing, background change, camera movement, zoom, pan, jitter, blur, slow motion',
      duration: 10,
      aspectRatio: '9:16',
      mode: 'pro',
      cfgScale: 1.0,
      cameraControl: {
        type: 'simple',
        config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 },
      },
    },
  },

  {
    templateId: 'viral_fast_hype_120',
    name: 'Turbo Dance',
    energyType: 'hype',
    baseBpm: 120,
    baseDurationSec: 8.0,
    dropHitTimeSec: 1.0,
    maxRetimingPercent: 0.12,
    providerDurationSec: 10,
    prompt:
      VIRAL_MASTER_BASE_PROMPT +
      'Fast energetic dance choreography at 120 BPM. ' +
      'Count 1-2: explosive double shoulder bounce, wide grin. ' +
      'Count 3-4: rapid left-right-left shoulder combo, head follows. ' +
      'Count 5-6: both hands clap at chest, arms spread wide briefly. ' +
      'Count 7-8: fast arm wave from right to left across body. ' +
      'Count 9-12: shoulder shimmy decelerating, arms lower, expression resets. ' +
      'High tempo, maximum energy, tight movements. Seamless loop.',
    kling: {
      prompt: null,
      negativePrompt:
        'identity drift, face morphing, background change, camera movement, zoom, pan, jitter, blur, slow motion',
      duration: 10,
      aspectRatio: '9:16',
      mode: 'pro',
      cfgScale: 1.0,
      cameraControl: {
        type: 'simple',
        config: { horizontal: 0, vertical: 0, pan: 0, tilt: 0, roll: 0, zoom: 0 },
      },
    },
  },
];

/**
 * Look up a viral template by ID.
 * @param {string} templateId
 * @returns {object|undefined}
 */
function getViralTemplate(templateId) {
  return VIRAL_TEMPLATES.find((t) => t.templateId === templateId);
}

module.exports = { VIRAL_TEMPLATES, getViralTemplate, VIRAL_MASTER_BASE_PROMPT };
