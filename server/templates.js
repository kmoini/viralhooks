// ──────────────────────────────────────────────────
// Dance-template presets  (server-side only)
//
// Each template defines the Runway promptText and
// any extra SDK parameters. The app sends a templateId
// and the server looks up the matching preset here.
// ──────────────────────────────────────────────────

const templates = {
  '1': {
    name: 'Fun Groove',

    // ── Prompt ──────────────────────────────────────
    // Combines positive instructions AND negative
    // constraints in one string, because the Runway
    // gen3a_turbo model has no separate negative-prompt
    // parameter.
    promptText: [
      // POSITIVE — what we want
      'The person in the uploaded photo performs a fun, energetic dance.',
      'Small rhythmic side-to-side steps, arm grooves, and subtle body bounce.',
      'The person faces the camera the entire time and is smiling.',
      'Maintain the exact same face, hairstyle, clothing, skin tone, and age throughout the entire video.',
      'The background stays completely unchanged and static.',
      'The camera is locked in place — no zoom, no pan, no cuts.',
      'Natural, realistic human motion with smooth transitions.',

      // NEGATIVE — what we do NOT want
      'Do not change the person\'s facial features, identity, hairstyle, or clothing at any point.',
      'No face morphing, no warping, no new people appearing.',
      'No camera movement, no scene changes, no background changes.',
      'No cartoon style, no anime style, no artistic filters.',
    ].join(' '),

    // ── Extra Runway parameters ─────────────────────
    duration: 5,          // always 5 seconds
    // ratio: not set — let Runway auto-fit the input image's natural shape
  },
};

// Fall back to template 1 if an unknown ID is requested
function getTemplate(templateId) {
  return templates[templateId] || templates['1'];
}

module.exports = { getTemplate };
