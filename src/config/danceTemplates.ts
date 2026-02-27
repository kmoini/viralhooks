import { DanceTemplate } from '../types/DanceTemplate';

export const danceTemplates: DanceTemplate[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: i < 6
    ? ['Shoulder Pop', 'Side-to-Side Groove', 'Two-Step + Hand Wave', 'Head Nod + Finger Snap', 'Hip Sway', 'Jump Bounce'][i]
    : `Template #${i + 1}`,
  enabled: i < 6,
}));
