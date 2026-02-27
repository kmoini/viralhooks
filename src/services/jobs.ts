import api from './api';

/**
 * Start an animation job by uploading the actual image file.
 * Sends multipart/form-data with the image from the phone's gallery.
 * Returns the taskId string.
 */
export async function startAnimateWithImage(
  templateId: string,
  imageUri: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('templateId', templateId);
  formData.append('durationSeconds', '5');

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

/**
 * Call GET /api/task/:taskId to check job progress.
 * Returns { status: "PENDING" | "SUCCEEDED" | "FAILED", videoUrl?: string }
 */
export async function getTask(
  taskId: string,
): Promise<{ status: string; videoUrl?: string }> {
  const response = await api.get(`/api/task/${taskId}`);
  return response.data;
}
