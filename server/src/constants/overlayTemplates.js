// ──────────────────────────────────────────────────
// Backend overlay template catalog
//
// Each template defines text placement, emoji, font
// scaling, and border rendering params for FFmpeg
// drawtext filters.
// ──────────────────────────────────────────────────

const OVERLAY_TEMPLATES = [
  { id: 'beat_drop',          placement: 'top_center',    emoji: '🔥',    defaultText: 'WHEN THE BEAT DROPS',                     fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'try_not_to_dance',   placement: 'top_center',    emoji: '💃',    defaultText: 'TRY NOT TO DANCE CHALLENGE',              fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'pov',                placement: 'top_center',    emoji: '😂',    defaultText: 'POV: YOU SAID "ONE MORE TAKE"',            fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'main_character',     placement: 'top_center',    emoji: '✨',    defaultText: 'MAIN CHARACTER ENERGY',                   fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'wait_for_it',        placement: 'top_center',    emoji: '⏳',    defaultText: 'WAIT FOR IT…',                            fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'cant_stop',          placement: 'top_center',    emoji: '😭',    defaultText: "WHY CAN'T I STOP DOING THIS",             fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'this_song',          placement: 'top_center',    emoji: '😮‍💨',   defaultText: 'THIS SONG DOES SOMETHING TO ME',          fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'obsession',          placement: 'top_center',    emoji: '🔓',    defaultText: 'NEW OBSESSION UNLOCKED',                  fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'rate_this',          placement: 'bottom_center', emoji: '⭐️',   defaultText: 'RATE THIS 1–10',                          fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'comment_yes',        placement: 'bottom_center', emoji: '👇',    defaultText: 'COMMENT "YES" IF YOU\'D TRY THIS',        fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'sound_on',           placement: 'top_left',      emoji: '🔊',    defaultText: 'SOUND ON',                                fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'turn_it_up',         placement: 'top_left',      emoji: '🎧',    defaultText: 'TURN IT UP',                              fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'camera_on',          placement: 'top_center',    emoji: '😳',    defaultText: 'ME WHEN THE CAMERA TURNS ON',             fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'caught_you',         placement: 'top_center',    emoji: '👀',    defaultText: 'CAUGHT YOU WATCHING',                     fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'lowkey_ate',         placement: 'top_center',    emoji: '😌',    defaultText: 'LOWKEY… I ATE THIS',                      fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'duet_this',          placement: 'bottom_center', emoji: '🤝',    defaultText: 'DUET THIS WITH YOUR VERSION',             fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'stitch_this',        placement: 'bottom_center', emoji: '😈',    defaultText: 'STITCH THIS IF YOU CAN DO BETTER',        fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'a_or_b',             placement: 'bottom_center', emoji: '🅰️🅱️', defaultText: 'WHICH ONE WINS? A OR B',                  fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'day_trying',         placement: 'top_center',    emoji: '📅',    defaultText: 'DAY 1 OF TRYING THIS TREND',              fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
  { id: 'i_fear_i_ate',       placement: 'top_center',    emoji: '🫢',    defaultText: 'I FEAR I ATE',                            fontScaleText: 0.07, fontScaleEmoji: 0.10, borderWText: 6, borderWEmoji: 4, colorText: 'white', borderColor: 'black' },
];

/**
 * Get overlay template by id.
 * @param {string} id
 * @returns {object|undefined}
 */
function getOverlayTemplate(id) {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}

module.exports = { OVERLAY_TEMPLATES, getOverlayTemplate };
