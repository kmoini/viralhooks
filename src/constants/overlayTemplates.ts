export type OverlayPlacement =
  | 'top_center'
  | 'bottom_center'
  | 'top_left'
  | 'top_right'
  | 'bottom_right';

export type OverlayStyle = 'bold' | 'caption';

export interface OverlayTemplate {
  id: string;
  title: string;
  emoji: string;
  defaultText: string;
  placement: OverlayPlacement;
  style: OverlayStyle;
}

const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  { id: 'beat_drop',          title: 'Beat Drop 🔥',           emoji: '🔥',    defaultText: 'WHEN THE BEAT DROPS',                     placement: 'top_center',    style: 'bold' },
  { id: 'try_not_to_dance',   title: 'Try Not To Dance 💃',    emoji: '💃',    defaultText: 'TRY NOT TO DANCE CHALLENGE',              placement: 'top_center',    style: 'bold' },
  { id: 'pov',                title: 'POV 😂',                 emoji: '😂',    defaultText: 'POV: YOU SAID "ONE MORE TAKE"',            placement: 'top_center',    style: 'bold' },
  { id: 'main_character',     title: 'Main Character ✨',      emoji: '✨',    defaultText: 'MAIN CHARACTER ENERGY',                   placement: 'top_center',    style: 'bold' },
  { id: 'wait_for_it',        title: 'Wait For It ⏳',         emoji: '⏳',    defaultText: 'WAIT FOR IT…',                            placement: 'top_center',    style: 'bold' },
  { id: 'cant_stop',          title: "Can't Stop 😭",          emoji: '😭',    defaultText: "WHY CAN'T I STOP DOING THIS",             placement: 'top_center',    style: 'bold' },
  { id: 'this_song',          title: 'This Song 😮‍💨',          emoji: '😮‍💨',   defaultText: 'THIS SONG DOES SOMETHING TO ME',          placement: 'top_center',    style: 'bold' },
  { id: 'obsession',          title: 'Obsession 🔓',           emoji: '🔓',    defaultText: 'NEW OBSESSION UNLOCKED',                  placement: 'top_center',    style: 'bold' },
  { id: 'rate_this',          title: 'Rate This ⭐️',           emoji: '⭐️',   defaultText: 'RATE THIS 1–10',                          placement: 'bottom_center', style: 'bold' },
  { id: 'comment_yes',        title: 'Comment Yes 👇',         emoji: '👇',    defaultText: 'COMMENT "YES" IF YOU\'D TRY THIS',        placement: 'bottom_center', style: 'bold' },
  { id: 'sound_on',           title: 'Sound On 🔊',            emoji: '🔊',    defaultText: 'SOUND ON',                                placement: 'top_left',      style: 'bold' },
  { id: 'turn_it_up',         title: 'Turn It Up 🎧',          emoji: '🎧',    defaultText: 'TURN IT UP',                              placement: 'top_left',      style: 'bold' },
  { id: 'camera_on',          title: 'Camera On 😳',           emoji: '😳',    defaultText: 'ME WHEN THE CAMERA TURNS ON',             placement: 'top_center',    style: 'bold' },
  { id: 'caught_you',         title: 'Caught You 👀',          emoji: '👀',    defaultText: 'CAUGHT YOU WATCHING',                     placement: 'top_center',    style: 'bold' },
  { id: 'lowkey_ate',         title: 'Lowkey Ate 😌',          emoji: '😌',    defaultText: 'LOWKEY… I ATE THIS',                      placement: 'top_center',    style: 'bold' },
  { id: 'duet_this',          title: 'Duet This 🤝',           emoji: '🤝',    defaultText: 'DUET THIS WITH YOUR VERSION',             placement: 'bottom_center', style: 'bold' },
  { id: 'stitch_this',        title: 'Stitch This 😈',         emoji: '😈',    defaultText: 'STITCH THIS IF YOU CAN DO BETTER',        placement: 'bottom_center', style: 'bold' },
  { id: 'a_or_b',             title: 'A or B 🅰️🅱️',            emoji: '🅰️🅱️', defaultText: 'WHICH ONE WINS? A OR B',                  placement: 'bottom_center', style: 'bold' },
  { id: 'day_trying',         title: 'Day 1 📅',               emoji: '📅',    defaultText: 'DAY 1 OF TRYING THIS TREND',              placement: 'top_center',    style: 'bold' },
  { id: 'i_fear_i_ate',       title: 'I Fear I Ate 🫢',        emoji: '🫢',    defaultText: 'I FEAR I ATE',                            placement: 'top_center',    style: 'bold' },
];

export default OVERLAY_TEMPLATES;

export function getOverlayTemplate(id: string): OverlayTemplate | undefined {
  return OVERLAY_TEMPLATES.find((t) => t.id === id);
}
