// ──────────────────────────────────────────────────
// Kling 2.6 client via PiAPI  (server-side only)
//
// Uses global fetch (Node 18+). No extra dependencies.
// Auth: x-api-key header with KLING_API_KEY env var.
// ──────────────────────────────────────────────────

const BASE_URL = 'https://api.piapi.ai/api/v1';

// ── Internal helper ─────────────────────────────

async function piapiFetch(path, { method = 'GET', body } = {}) {
  const apiKey = process.env.KLING_API_KEY;
  if (!apiKey) throw new Error('KLING_API_KEY is not set in environment');

  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);

  let data;
  try {
    data = await res.json();
  } catch {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`PiAPI ${method} ${path} returned ${res.status}: ${text}`);
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || JSON.stringify(data);
    throw new Error(`PiAPI ${method} ${path} returned ${res.status}: ${msg}`);
  }

  return data;
}

// ── Exported functions ──────────────────────────

/**
 * Start an image-to-video generation task.
 * @param {object} params
 * @param {string} params.imageUrl  - publicly accessible image URL
 * @param {object} params.templateKling - the template.kling config object
 * @returns {Promise<string>} providerTaskId
 */
async function startImageToVideo({ imageUrl, templateKling }) {
  const payload = {
    model: 'kling',
    task_type: 'video_generation',
    input: {
      prompt: templateKling.prompt,
      negative_prompt: templateKling.negativePrompt || '',
      cfg_scale: templateKling.cfgScale ?? 1.0,
      duration: templateKling.duration ?? 5,
      aspect_ratio: templateKling.aspectRatio ?? '9:16',
      mode: templateKling.mode ?? 'pro',
      image_url: imageUrl,
      camera_control: templateKling.cameraControl,
    },
  };

  const data = await piapiFetch('/task', { method: 'POST', body: payload });

  const taskId = data?.data?.task_id || data?.task_id;
  if (!taskId) {
    throw new Error(`PiAPI did not return a task_id: ${JSON.stringify(data)}`);
  }

  return taskId;
}

/**
 * Get the current state of a task.
 * @param {string} providerTaskId
 * @returns {Promise<object>} task data
 */
async function getTask(providerTaskId) {
  const data = await piapiFetch(`/task/${providerTaskId}`);
  return data?.data || data;
}

/**
 * Map PiAPI status strings to our app status.
 * @param {string} providerStatus
 * @returns {"PENDING"|"SUCCEEDED"|"FAILED"}
 */
function mapStatus(providerStatus) {
  const s = (providerStatus || '').toLowerCase();
  if (s === 'completed' || s === 'succeeded') return 'SUCCEEDED';
  if (s === 'failed' || s === 'error') return 'FAILED';
  return 'PENDING';
}

/**
 * Extract the video URL from a completed task.
 * @param {object} taskData - the object returned by getTask()
 * @returns {string|null} mp4 URL or null
 */
function extractVideoUrl(taskData) {
  try {
    const work = taskData?.output?.works?.[0]?.video;
    return work?.resource_without_watermark || work?.resource || null;
  } catch {
    return null;
  }
}

module.exports = {
  startImageToVideo,
  getTask,
  mapStatus,
  extractVideoUrl,
};
