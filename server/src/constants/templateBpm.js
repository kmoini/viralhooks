/**
 * Template BPM Map — native BPM for each dance template.
 * Used for beat-sync: speedFactor = musicBpm / templateBpm.
 */

const TEMPLATE_BPM = {
  // Frontend templates (from src/templates/templates.ts)
  'shoulder_fling_pink_lemonade': 106,
  'beat_switch_reaction_bazooka': 108,
  'point_to_caption_iloveitiloveit': 110,
  'afro_head_bounce_amapiano': 104,
  'partner_mirror_feeling_on_my_body': 110,

  // Viral templates (from server/src/data/viralTemplates.js)
  'viral_meme_slow_90': 90,
  'viral_smooth_95': 95,
  'viral_hype_105': 105,
  'viral_hype_112': 112,
  'viral_fast_hype_120': 120,

  // Original server templates (from server/danceTemplates.js)
  '1': 105,
  '2': 100,
  '3': 108,
  '4': 95,
  '5': 100,
  '6': 115,
};

const DEFAULT_BPM = 105;

/**
 * Get the native BPM for a template.
 * @param {string} templateId
 * @returns {number}
 */
function getTemplateBpm(templateId) {
  return TEMPLATE_BPM[templateId] || DEFAULT_BPM;
}

module.exports = { TEMPLATE_BPM, DEFAULT_BPM, getTemplateBpm };
