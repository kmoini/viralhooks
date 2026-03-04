export type DanceTemplate = {
  id: string;
  name: string;
  category: 'Trending' | 'Funny' | 'Easy' | 'Energy' | 'Duet' | 'Meme' | 'Vibes';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  duration: number;
  bpm: number;
  loopSeconds: number;
  framing: 'head';
  viralityScore: number;
  thumbnailVideo: string;
  previewImage: string;
  tags: string[];
  prompt: string;
};

const MASTER_BASE_PROMPT =
  'Chest-up framing only (top of head to mid torso). ' +
  'Camera locked, no zoom, no rotation, no perspective change. ' +
  'Preserve identity, hair, beard, skin tone, clothing, background exactly. ' +
  'Motion only in shoulders, head, arms, hands, upper torso. ' +
  'Natural physics, no morphing, no warping, no identity drift. ' +
  '100-110 BPM feel, clear 8-count rhythm. ' +
  'Loop: final pose matches starting pose seamlessly. ' +
  'Eyes engaged with camera, subtle eyebrow accents. ' +
  'Lighting constant throughout. ' +
  'Motion amplitude: medium TikTok realism.\n\n';

export const DANCE_TEMPLATES: DanceTemplate[] = [
  {
    id: 'shoulder_fling_pink_lemonade',
    name: 'Shoulder Fling — Pink Lemonade',
    category: 'Trending',
    difficulty: 'Easy',
    duration: 4,
    bpm: 106,
    loopSeconds: 4,
    framing: 'head',
    viralityScore: 9.5,
    thumbnailVideo: '',
    previewImage: '',
    tags: ['flagship', 'shoulders', 'loop', 'easy', 'tiktok'],
    prompt:
      MASTER_BASE_PROMPT +
      'Beat-mapped 8-count choreography at 106 BPM. ' +
      'Count 1-2: sharp right shoulder pop up then down. ' +
      'Count 3-4: sharp left shoulder pop up then down. ' +
      'Count 5-6: both shoulders roll back simultaneously with slight chest lift. ' +
      'Count 7-8: smooth return to starting pose with gentle head tilt reset. ' +
      'Micro facial acting: slight smirk on counts 1-2, raised eyebrow on count 5, relaxed smile on count 8. ' +
      'Hands relaxed at mid-chest height with natural wrist sway. ' +
      'Loop seam: count 8 pose matches count 1 starting position exactly.',
  },
  {
    id: 'beat_switch_reaction_bazooka',
    name: 'Beat Switch Reaction — Bazooka',
    category: 'Trending',
    difficulty: 'Medium',
    duration: 4,
    bpm: 108,
    loopSeconds: 4,
    framing: 'head',
    viralityScore: 9.2,
    thumbnailVideo: '',
    previewImage: '',
    tags: ['reaction', 'switch', 'groove', 'combo', 'loop'],
    prompt:
      MASTER_BASE_PROMPT +
      'Beat-mapped 8-count choreography at 108 BPM. ' +
      'Count 1-2: slow laid-back groove, minimal shoulder sway, cool expression. ' +
      'Count 3-4: sudden energy switch, fast shoulder combo left-right-left. ' +
      'Count 5-6: rapid arm wave from chest outward with head bounce. ' +
      'Count 7-8: decelerate smoothly, return to relaxed starting pose. ' +
      'Reaction face: calm on 1-2, surprised wide eyes on 3, confident grin on 5-6, neutral reset on 8. ' +
      'Identity-safe: no face morphing, no background change.',
  },
  {
    id: 'point_to_caption_iloveit',
    name: 'Point to Caption — ILOVEITILOVEIT',
    category: 'Meme',
    difficulty: 'Easy',
    duration: 4,
    bpm: 110,
    loopSeconds: 4,
    framing: 'head',
    viralityScore: 9.0,
    thumbnailVideo: '',
    previewImage: '',
    tags: ['meme', 'caption', 'pointing', 'eye-tracking', 'easy'],
    prompt:
      MASTER_BASE_PROMPT +
      'Beat-mapped 8-count choreography at 110 BPM. ' +
      'Count 1-2: right hand points to upper-right corner, eyes follow fingertip direction. ' +
      'Count 3-4: left hand points to upper-left corner, eyes track to follow. ' +
      'Count 5-6: both hands point upward together, eyes look up, slight eyebrow raise. ' +
      'Count 7-8: hands drop smoothly to starting position, eyes return to camera, soft smile. ' +
      'Head follows point direction with small natural tilts. ' +
      'Loop reset: count 8 returns to exact starting pose for seamless loop.',
  },
  {
    id: 'afro_head_bounce_amapiano',
    name: 'Afro Head Bounce — Amapiano Loop',
    category: 'Vibes',
    difficulty: 'Easy',
    duration: 5,
    bpm: 104,
    loopSeconds: 5,
    framing: 'head',
    viralityScore: 8.7,
    thumbnailVideo: '',
    previewImage: '',
    tags: ['vibes', 'groove', 'head-bounce', 'smooth', 'loop'],
    prompt:
      MASTER_BASE_PROMPT +
      'Continuous compact groove at 104 BPM over 10 counts. ' +
      'Steady head bounce on every beat, chin dips subtly down then up. ' +
      'Shoulders alternate gentle rolls, left then right, in sync with head. ' +
      'Subtle wrist rotations at chest height, fingers relaxed and loose. ' +
      'Eyebrow ticks on counts 3 and 7, slight smirk on count 5. ' +
      'Torso sways minimally side to side for natural feel. ' +
      'Smooth continuous motion, no sudden stops. ' +
      'Loop seam: final beat returns to exact starting pose and expression.',
  },
  {
    id: 'partner_mirror_feeling_on_my_body',
    name: 'Partner Mirror — Feeling on My Body',
    category: 'Duet',
    difficulty: 'Medium',
    duration: 5,
    bpm: 110,
    loopSeconds: 5,
    framing: 'head',
    viralityScore: 9.3,
    thumbnailVideo: '',
    previewImage: '',
    tags: ['duet', 'mirror', 'symmetry', 'split-screen', 'loop'],
    prompt:
      MASTER_BASE_PROMPT +
      'Symmetrical moves centered in frame for split-screen duet at 110 BPM. ' +
      'Count 1-2: both arms raise symmetrically from sides to shoulder height. ' +
      'Count 3-4: chest pop forward with both hands pulling back. ' +
      'Count 5-6: right shoulder roll into left shoulder roll, smooth transition. ' +
      'Count 7-8: wave motion from right hand to left hand across chest. ' +
      'Count 9-10: arms lower to start, head centers, expression resets. ' +
      'All motion centered and mirrored for left-right split-screen compatibility. ' +
      'Return to exact start pose for seamless loop.',
  },
];
