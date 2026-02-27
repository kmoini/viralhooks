// ──────────────────────────────────────────────────
// Dance-template presets  (server-side only)
//
// IMPORTANT: Runway has a 1000 char limit on promptText.
//
// KEY LEARNING: "Do not" / negative instructions BACKFIRE
// in generative AI. They make the model think about the
// thing you're trying to avoid. Keep prompts SHORT and
// POSITIVE — describe only what you WANT to see.
//
// Kling 2.6: Templates may include an optional `kling`
// object with Kling-specific settings (prompt, negative
// prompt, camera control, etc.). If absent, the server
// falls back to the base promptText.
// ──────────────────────────────────────────────────

const templates = {
  '1': {
    name: 'Shoulder Pop',
    promptText: 'The person gently pops their shoulders left and right to a rhythm. Subtle movement. Static camera.',
    driverVideo: 'shoulder_pop.mp4',
    duration: 5,
    kling: {
      prompt:
        'Preserve the exact person\'s identity, face, skin texture, hairstyle, hairline, eyebrows, eyelashes, eye shape, nose, lips, teeth, facial hair if any, body shape, clothing, background, lighting, and camera angle. Do not beautify or stylize. Keep the original framing exactly the same. Only animate natural human motion.\n\n' +
        'The person performs an expressive upper-body dance with alternating shoulder pops and shoulder rolls, rhythmic torso groove, and subtle chest pulses. Both hands are actively dancing with natural wrist rotations and finger articulation, but hands stay at chest-to-shoulder height and never touch or cover the face. Arms move smoothly while staying in frame.\n\n' +
        'Natural facial animation including eye blinks, slight eyebrow raises, playful eye direction changes, subtle lip movements as if mouthing lyrics, and brief soft smiles. Maintain exact facial identity with stable geometry and no warping.\n\n' +
        'Add small head tilts and gentle head bounces synchronized with the shoulders.\n\n' +
        'Realistic anatomy, stable face, no morphing, no background change, no camera movement, no zoom, consistent lighting. Hair moves only minimally with natural physics.\n\n' +
        'Create a seamless 3–4 second loop.',
      negativePrompt:
        'identity drift, different person, face morphing, face warping, changing hairline, hairstyle change, beard change, makeup change, beauty filter, stylized, background change, lighting change, camera movement, zoom, pan, tilt, roll, reframing, crop, hands near face, hands covering face, head enlargement, jitter, flicker, artifacts, low quality, blurry, deformed hands, extra fingers, missing fingers',
      duration: 5,
      aspectRatio: '9:16',
      mode: 'pro',
      cfgScale: 1.0,
      cameraControl: {
        type: 'simple',
        config: {
          horizontal: 0,
          vertical: 0,
          pan: 0,
          tilt: 0,
          roll: 0,
          zoom: 0,
        },
      },
    },
  },

  '2': {
    name: 'Side-to-Side Groove',
    promptText: 'The person does a fun side-to-side groove, shifting weight left to right. Subtle body bounce. Static camera.',
    driverVideo: 'side_to_side_groove.mp4',
    duration: 5,
  },

  '3': {
    name: 'Two-Step + Hand Wave',
    promptText: 'The person does a simple two-step, stepping right then left. One hand waves playfully. Static camera.',
    driverVideo: 'two_step_hand_wave.mp4',
    duration: 5,
  },

  '4': {
    name: 'Head Nod + Finger Snap',
    promptText: 'The person nods head to a beat and snaps fingers alternating hands. Subtle bounce. Static camera.',
    driverVideo: 'head_nod_finger_snap.mp4',
    duration: 5,
  },

  '5': {
    name: 'Hip Sway',
    promptText: 'The person sways hips smoothly side to side in a slow rhythm. Hands on hips. Static camera.',
    driverVideo: 'hip_sway.mp4',
    duration: 5,
  },

  '6': {
    name: 'Jump Bounce',
    promptText: 'The person does small playful bouncy jumps in place. Arms pump with each bounce. Static camera.',
    driverVideo: 'jump_bounce.mp4',
    duration: 5,
  },
};

// Fall back to template 1 if an unknown ID is requested
function getTemplate(templateId) {
  return templates[templateId] || templates['1'];
}

module.exports = { getTemplate };
