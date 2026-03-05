/**
 * Generates a viral TikTok caption with hashtags.
 *
 * Designed to be extended later with templateId-specific,
 * music-specific, or energyType-specific captions.
 */

const hashtagSets: Record<string, string[]> = {
  default: ['#fyp', '#viral', '#dance', '#snapdance', '#trend'],
  funny: ['#fyp', '#funny', '#dancechallenge', '#snapdance', '#lol'],
  energy: ['#fyp', '#dance', '#vibes', '#snapdance', '#energy'],
};

const defaultCaptions = [
  'POV: The beat dropped and you couldn\u2019t stop dancing \uD83D\uDE02',
  'Nobody: \nMe when this song comes on:',
  'This dance lives rent free in my head \uD83D\uDC83',
  'Tried this trend and now I\u2019m addicted',
  'When the algorithm picks your perfect dance \uD83D\uDD25',
  'Me pretending I can dance vs actually nailing it',
  'This sound + this dance = instant serotonin \u2728',
  'Day 1 of making everyone learn this dance',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateCaption(
  templateId: string,
  musicName?: string,
  energyType?: string,
): string {
  const caption = pickRandom(defaultCaptions);

  // Pick hashtag set based on energy (extensible later)
  const setKey = energyType && energyType in hashtagSets ? energyType : 'default';
  const hashtags = hashtagSets[setKey].join(' ');

  // If music name is provided, mention it
  const musicLine = musicName ? `\uD83C\uDFB5 ${musicName}` : '';

  const parts = [caption, musicLine, hashtags].filter(Boolean);
  return parts.join('\n\n');
}
