// ──────────────────────────────────────────────────
// Runway SDK wrapper  (only used when USE_RUNWAY=true)
// ──────────────────────────────────────────────────
const RunwayML  = require('@runwayml/sdk');
const { toFile } = require('@runwayml/sdk');
const fs   = require('fs');
const path = require('path');

// The SDK reads RUNWAYML_API_SECRET from process.env automatically.
// We create the client once and reuse it.
let client = null;

function getClient() {
  const apiKey = process.env.RUNWAYML_API_SECRET || '';
  if (!apiKey || apiKey.includes('PASTE') || apiKey.includes('placeholder') || apiKey.includes('HERE')) {
    throw new Error(
      'RUNWAYML_API_SECRET is missing or still a placeholder. ' +
      'Set a real API key in server/.env'
    );
  }
  if (!client) {
    client = RunwayML();   // uses RUNWAYML_API_SECRET from env
    console.log('[RUNWAY] SDK client initialized');
  }
  return client;
}

// ── Start an image-to-video task ─────────────────
// imagePath = local file path on disk (from multer upload)
// template  = preset object from templates.js (has promptText, duration, ratio)
// Returns the Runway task ID string.
async function startImageToVideo(imagePath, template) {
  const runway = getClient();

  // 1. Upload the local image to Runway's ephemeral storage.
  //    The SDK requires an HTTPS URL for promptImage, so we
  //    upload first and get back a runway:// URI.
  console.log(`[RUNWAY] Uploading image: ${path.basename(imagePath)}`);

  const buffer   = fs.readFileSync(imagePath);
  const ext      = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const file   = await toFile(buffer, path.basename(imagePath), { type: mimeType });
  const upload = await runway.uploads.createEphemeral({ file });

  console.log(`[RUNWAY] Image uploaded to Runway: ${upload.uri}`);

  // 2. Build the request using template settings.
  const params = {
    model:       'gen3a_turbo',
    promptImage: upload.uri,
    promptText:  template.promptText,
    duration:    template.duration || 5,
  };

  // Only set ratio if the template defines one
  if (template.ratio) {
    params.ratio = template.ratio;
  }

  console.log(`[RUNWAY] Template: "${template.name}" | Prompt: ${params.promptText.length} chars | Ratio: ${params.ratio || 'auto'}`);
  console.log(`[RUNWAY] Full prompt sent:\n---\n${params.promptText}\n---`);

  // 3. Start the image-to-video generation task.
  const task = await runway.imageToVideo.create(params);

  console.log(`[RUNWAY] Started task: ${task.id}`);
  return task.id;
}

// ── Check Runway task status ─────────────────────
// Maps Runway's many statuses down to our three:
//   PENDING  |  SUCCEEDED  |  FAILED
async function getRunwayTaskStatus(runwayTaskId) {
  const runway = getClient();
  const task   = await runway.tasks.retrieve(runwayTaskId);

  // Runway returns: PENDING, THROTTLED, RUNNING, SUCCEEDED, FAILED, CANCELLED
  console.log(`[RUNWAY] Status for ${runwayTaskId}: ${task.status}`);

  if (task.status === 'SUCCEEDED') {
    return {
      status:   'SUCCEEDED',
      videoUrl: task.output[0],       // first item is the video URL
    };
  }

  if (task.status === 'FAILED') {
    return {
      status: 'FAILED',
      error:  task.failure || 'Runway task failed',
    };
  }

  if (task.status === 'CANCELLED') {
    return {
      status: 'FAILED',
      error:  'Task was cancelled',
    };
  }

  // PENDING, RUNNING, THROTTLED  -->  treat as still working
  return { status: 'PENDING' };
}

module.exports = { startImageToVideo, getRunwayTaskStatus };
