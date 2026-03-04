export interface MusicInfo {
  musicId: string;
  source: 'catalog' | 'upload' | 'extract';
  title: string;
  artist: string;
  previewUrl: string;
  audioUrl: string;
  bpm: number;
  bpmDetected: boolean;
  durationSec?: number;
  createdAt?: string;
}
