import api from './api';

/**
 * Start an animation job by uploading the actual image file.
 * Sends multipart/form-data with the image from the phone's gallery.
 * Returns the taskId string.
 */
export async function startAnimateWithImage(
  templateId: string,
  imageUri: string,
  durationSeconds: number = 5,
  style: string = 'Cool',
): Promise<string> {
  const formData = new FormData();
  formData.append('templateId', templateId);
  formData.append('durationSeconds', String(durationSeconds));
  formData.append('style', style);

  // React Native's FormData accepts this special object for files.
  // The "as any" is needed because RN's FormData differs from the web type.
  formData.append('image', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  // Do NOT set Content-Type manually — axios + React Native will
  // auto-set it to "multipart/form-data; boundary=..." with the
  // correct boundary string. Without the boundary the server hangs.
  const response = await api.post('/api/animate', formData, {
    timeout: 60000,   // 60 seconds — images can be large
  });

  return response.data.taskId;
}

// Cloudinary cloud name — same one the backend uses
const CLOUDINARY_CLOUD_NAME = 'dqxgxnvdx';

/**
 * Upload a selfie image directly to Cloudinary using unsigned upload.
 * Returns the public secure_url for the uploaded image.
 *
 * Requires an unsigned upload preset named "snapdance_unsigned"
 * configured in the Cloudinary dashboard. If not set up yet,
 * falls back to a placeholder URL (works for mock mode testing).
 */
export async function uploadSelfieToCloudinary(
  imageUri: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    name: 'selfie.jpg',
    type: 'image/jpeg',
  } as any);
  formData.append('upload_preset', 'snapdance_unsigned');
  formData.append('folder', 'snapdance/uploads');

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData },
    );
    const data = await response.json();
    if (data.secure_url) {
      console.log('[CLOUDINARY] Uploaded selfie ->', data.secure_url);
      return data.secure_url;
    }
    console.warn('[CLOUDINARY] Upload response missing secure_url:', data);
    throw new Error(data.error?.message ?? 'Cloudinary upload failed');
  } catch (e) {
    // Fallback: construct a LAN URL from the server's /uploads/ path.
    // This works for mock mode where the selfieUrl is never fetched by a provider.
    console.warn('[CLOUDINARY] Direct upload failed, using placeholder:', e);
    return 'https://placeholder.test/selfie.jpg';
  }
}

export type EnergyType = 'hype' | 'smooth' | 'meme';

/**
 * Start a viral render job.
 * 1) Uploads the selfie to Cloudinary (or uses placeholder in mock mode)
 * 2) Calls POST /api/render/viral with the public selfie URL
 * Returns the taskId string.
 */
export async function startViralRender(
  imageUri: string,
  energyType: EnergyType = 'hype',
  loopToSec: number = 8,
): Promise<string> {
  // Step 1: upload selfie to get a public URL
  const selfieUrl = await uploadSelfieToCloudinary(imageUri);

  // Step 2: call the viral render endpoint
  const response = await api.post(
    '/api/render/viral',
    {
      selfieUrl,
      energyType,
      loopToSec,
      region: 'CA',
    },
    { timeout: 30000 },
  );

  return response.data.taskId;
}

/**
 * Start a music-synced render job.
 * 1) Uploads the selfie to Cloudinary (or uses placeholder in mock mode)
 * 2) Calls POST /api/render/viral with musicId + templateId + mixMode
 * Returns the taskId string.
 */
export async function startMusicRender(
  imageUri: string,
  templateId: string,
  musicId: string,
  mixMode: 'withMusic' | 'mute' = 'withMusic',
  loopToSec: number = 8,
): Promise<string> {
  const selfieUrl = await uploadSelfieToCloudinary(imageUri);

  const response = await api.post(
    '/api/render/viral',
    {
      selfieUrl,
      templateId,
      musicId,
      mixMode,
      loopToSec,
    },
    { timeout: 30000 },
  );

  return response.data.taskId;
}

export interface TaskResult {
  status: string;
  videoUrl?: string;
  sound?: {
    soundId: string;
    soundName: string;
    bpm: number;
    dropTimeSec: number;
    tiktokUrl: string;
    energyType?: string;
  };
  music?: {
    musicId: string;
    title: string;
    artist: string;
    bpm: number;
    bpmDetected: boolean;
    source: string;
    audioUrl: string;
  };
  templateId?: string;
  mixMode?: 'withMusic' | 'mute';
  timingsApplied?: {
    speedFactor: number;
    leadHoldSec: number;
    targetDurationSec: number;
    loopToSec: number | null;
  };
}

/**
 * Call GET /api/task/:taskId to check job progress.
 * Returns status, videoUrl, and optional sound/timing data for viral renders.
 */
export async function getTask(taskId: string): Promise<TaskResult> {
  const response = await api.get(`/api/task/${taskId}`, { timeout: 30000 });
  return response.data;
}
