// ──────────────────────────────────────────────────
// Kling 2.6 client via PiAPI  (server-side only)
//
// Uses global fetch (Node 18+). No extra dependencies.
// Auth: x-api-key header with KLING_API_KEY env var.
//
// PiAPI task shape:
//   { code, data: { task_id, status, output: { works: [{ video: { resource, resource_without_watermark } }] }, error: { code, message } } }
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
 * Get the raw PiAPI response for a task (full envelope with code + data).
 * Used by the debug endpoint.
 * @param {string} providerTaskId
 * @returns {Promise<object>} full PiAPI response
 */
async function getRawTask(providerTaskId) {
  return await piapiFetch(`/task/${providerTaskId}`);
}

/**
 * Get the current state of a task (unwrapped .data).
 * @param {string} providerTaskId
 * @returns {Promise<object>} task data
 */
async function getTask(providerTaskId) {
  const raw = await getRawTask(providerTaskId);
  return raw?.data || raw;
}

/**
 * Parse a PiAPI task response into a normalized status snapshot.
 * Single source of truth for determining task state.
 *
 * Status values:
 *   SUCCEEDED        — videoUrl is non-empty
 *   COMPLETED_NO_URL — provider says completed/work0Status==20 but videoUrl is empty
 *   FAILED           — apiStatus is "failed"/"error", OR error.code != 0, OR error.message non-empty
 *   PENDING          — everything else (still processing)
 *
 * @param {object} taskData - the unwrapped task data from getTask()
 * @returns {object} { status, videoUrl, apiStatus, outputStatus, works, work0Status, error, ... }
 */
function parseTaskStatus(taskData) {
  const apiStatus = (taskData?.status || 'unknown');

  // Extract works and video URL
  const works = taskData?.output?.works || [];
  const work0 = works[0] || {};
  const video = work0?.video || {};
  const videoUrl = video.resource_without_watermark || video.resource || null;

  // Extract error info
  const errObj = taskData?.error || {};
  const errCode = errObj.code ?? null;
  const errMsg = errObj.message || '';
  const hasError =
    (errCode !== null && errCode !== 0) ||
    errMsg.length > 0;

  // Extract timing metadata from PiAPI response
  const meta = taskData?.meta || {};
  const rawCreatedAt = meta.created_at || taskData?.created_at || null;
  const rawStartedAt = meta.started_at || taskData?.started_at || null;

  // Treat PiAPI zero-value placeholder "0001-01-01T00:00:00Z" as null
  const ZERO_TIME = '0001-01-01';
  const createdAt = (rawCreatedAt && !rawCreatedAt.startsWith(ZERO_TIME)) ? rawCreatedAt : null;
  const startedAt = (rawStartedAt && !rawStartedAt.startsWith(ZERO_TIME)) ? rawStartedAt : null;

  // Queue delay = time between created_at and started_at (seconds)
  let queueDelaySec = null;
  if (createdAt && startedAt) {
    const createdMs = new Date(createdAt).getTime();
    const startedMs = new Date(startedAt).getTime();
    if (!isNaN(createdMs) && !isNaN(startedMs)) {
      queueDelaySec = Math.round((startedMs - createdMs) / 1000);
    }
  }

  // Determine status
  let status = 'PENDING';
  const apiLower = apiStatus.toLowerCase();
  const w0Status = work0?.status;
  // Provider considers task done: apiStatus=="completed" OR work0.status==20
  const providerDone = apiLower === 'completed' || w0Status === 20 || w0Status === '20';

  if (videoUrl) {
    // Video URL present → done, regardless of apiStatus
    status = 'SUCCEEDED';
  } else if (apiLower === 'failed' || apiLower === 'error') {
    status = 'FAILED';
  } else if (hasError) {
    status = 'FAILED';
  } else if (providerDone) {
    // Provider says completed but video URL not populated yet
    status = 'COMPLETED_NO_URL';
  }
  // else: PENDING (still processing)

  return {
    status,
    videoUrl,
    apiStatus,
    outputStatus: taskData?.output?.status || 'unknown',
    works,
    work0Status: w0Status ?? 'unknown',
    error: hasError ? { code: errCode, message: errMsg } : null,
    createdAt,
    startedAt,
    queueDelaySec,
  };
}

/**
 * Wait for a video URL to appear after the provider says "completed".
 * Polls up to maxRetries times with intervalMs between each.
 *
 * @param {string} providerTaskId
 * @param {number} [maxRetries=10]
 * @param {number} [intervalMs=2000]
 * @returns {Promise<{videoUrl: string|null, parsed: object}>}
 */
async function waitForVideoUrl(providerTaskId, maxRetries = 10, intervalMs = 2000) {
  for (let i = 1; i <= maxRetries; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const taskData = await getTask(providerTaskId);
    const parsed = parseTaskStatus(taskData);

    console.log(`[KLING POLL] completed but waiting for video URL... attempt ${i}/${maxRetries} hasVideo=${!!parsed.videoUrl}`);

    if (parsed.videoUrl) {
      return { videoUrl: parsed.videoUrl, parsed };
    }
    if (parsed.status === 'FAILED') {
      return { videoUrl: null, parsed };
    }
  }
  // Exhausted retries — return last state with no URL
  console.warn(`[KLING POLL] gave up waiting for video URL after ${maxRetries} retries`);
  return { videoUrl: null, parsed: null };
}

/**
 * Build a compact one-line snapshot for logging.
 * Includes elapsed times and which timeout limit applies.
 * @param {string} providerTaskId
 * @param {object} parsed - output of parseTaskStatus()
 * @param {number} [jobCreatedAt] - Date.now() when the job was created locally
 * @returns {string}
 */
function snapshotLog(providerTaskId, parsed, jobCreatedAt) {
  const now = Date.now();

  // Elapsed since local job creation
  const sinceCreate = jobCreatedAt
    ? Math.round((now - jobCreatedAt) / 1000)
    : 'n/a';

  // Elapsed since provider started processing
  let sinceStart = 'n/a';
  if (parsed.startedAt) {
    const startMs = new Date(parsed.startedAt).getTime();
    if (!isNaN(startMs)) sinceStart = Math.round((now - startMs) / 1000);
  }

  return (
    `[KLING POLL] taskId=${providerTaskId}` +
    ` apiStatus=${parsed.apiStatus}` +
    ` outputStatus=${parsed.outputStatus}` +
    ` worksLen=${parsed.works?.length ?? 0}` +
    ` work0Status=${parsed.work0Status}` +
    ` hasVideo=${!!parsed.videoUrl}` +
    ` sinceCreate=${sinceCreate}s sinceStart=${sinceStart}s` +
    ` queueWaitLimit=${MAX_QUEUE_WAIT_MS / 1000}s procLimit=${MAX_PROCESSING_MS / 1000}s` +
    ` queueDelaySec=${parsed.queueDelaySec ?? 'n/a'}` +
    ` errCode=${parsed.error?.code ?? 'none'}` +
    ` errMsg=${parsed.error?.message ? '"' + parsed.error.message.slice(0, 80) + '"' : 'none'}`
  );
}

// ── Two-phase timeout logic ─────────────────────
// Avoids false timeouts when the provider queue is slow but processing is fast.

const MAX_QUEUE_WAIT_MS  = 12 * 60 * 1000; // 12 min waiting in queue
const MAX_PROCESSING_MS  = 12 * 60 * 1000; // 12 min once processing starts
const HARD_CAP_MS        = 25 * 60 * 1000; // 25 min absolute maximum

/**
 * Check if a Kling job should be timed out.
 * Returns { timedOut: false } or { timedOut: true, message: string }.
 *
 * @param {object} parsed - output of parseTaskStatus()
 * @param {number} jobCreatedAt - Date.now() when the local job was created
 * @returns {{ timedOut: boolean, message?: string }}
 */
function checkTimeout(parsed, jobCreatedAt) {
  const now = Date.now();
  const sinceCreateMs = now - (jobCreatedAt || now);

  // (c) Hard cap — always applies
  if (sinceCreateMs > HARD_CAP_MS) {
    return { timedOut: true, message: 'Timed out waiting for provider.' };
  }

  // (a) No startedAt → still in queue
  if (!parsed.startedAt) {
    if (sinceCreateMs > MAX_QUEUE_WAIT_MS) {
      return { timedOut: true, message: 'Provider queue is taking too long. Please retry.' };
    }
    return { timedOut: false };
  }

  // (b) startedAt exists → processing
  const startMs = new Date(parsed.startedAt).getTime();
  if (!isNaN(startMs)) {
    const sinceStartMs = now - startMs;
    if (sinceStartMs > MAX_PROCESSING_MS) {
      return { timedOut: true, message: 'Provider is taking too long to render. Please retry.' };
    }
  }

  return { timedOut: false };
}

// ── Legacy compat wrappers ──────────────────────

function mapStatus(providerStatus) {
  const s = (providerStatus || '').toLowerCase();
  if (s === 'completed' || s === 'succeeded') return 'SUCCEEDED';
  if (s === 'failed' || s === 'error') return 'FAILED';
  return 'PENDING';
}

function extractVideoUrl(taskData) {
  return parseTaskStatus(taskData).videoUrl;
}

module.exports = {
  startImageToVideo,
  getTask,
  getRawTask,
  mapStatus,
  extractVideoUrl,
  parseTaskStatus,
  waitForVideoUrl,
  snapshotLog,
  checkTimeout,
  MAX_QUEUE_WAIT_MS,
  MAX_PROCESSING_MS,
  HARD_CAP_MS,
};
