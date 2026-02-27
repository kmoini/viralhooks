# Services

## Frontend Services

### API Client

**File:** [`src/services/api.ts`](../src/services/api.ts)

Axios instance with centralized config.

| Setting | Value |
|---------|-------|
| Base URL | `http://192.168.2.75:3001` (hardcoded — must match dev machine LAN IP) |
| Timeout | 10 seconds |

**Usage:** Imported by `jobs.ts` for all HTTP requests.

> **Note:** The base URL must be updated whenever the developer's LAN IP changes. Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find the current Wi-Fi IPv4 address.

---

### Jobs Service

**File:** [`src/services/jobs.ts`](../src/services/jobs.ts)

#### `startAnimateWithImage(templateId: string, imageUri: string): Promise<string>`

Submits a generation job.

| Detail | Value |
|--------|-------|
| Method | POST |
| Endpoint | `/api/animate` |
| Content-Type | `multipart/form-data` (auto-set by Axios) |
| Timeout | 60 seconds (overrides default for large uploads) |
| Returns | `taskId` string |

**FormData fields:**

| Field | Value |
|-------|-------|
| `templateId` | String ID (`"1"` through `"6"`) |
| `durationSeconds` | `"5"` |
| `image` | `{ uri, name: 'photo.jpg', type: 'image/jpeg' }` (React Native file object) |

#### `getTask(taskId: string): Promise<{ status: string; videoUrl?: string }>`

Polls job status.

| Detail | Value |
|--------|-------|
| Method | GET |
| Endpoint | `/api/task/{taskId}` |
| Returns | `{ status: 'PENDING' \| 'SUCCEEDED' \| 'FAILED', videoUrl?: string }` |

---

## Backend Client Modules

### runwayClient.js

**File:** [`server/runwayClient.js`](../server/runwayClient.js)

Wraps the `@runwayml/sdk` package for image-to-video generation.

#### `startImageToVideo(imagePath, template)`

| Step | Action |
|------|--------|
| 1 | Read image file to buffer |
| 2 | Upload to Runway ephemeral storage (`runway.uploads.createEphemeral()`) |
| 3 | Create task with `model: 'gen3a_turbo'`, prompt from template, duration, optional ratio |
| Returns | Runway task ID string |

#### `getRunwayTaskStatus(runwayTaskId)`

| Provider Status | Mapped Status | Extra Fields |
|----------------|---------------|--------------|
| SUCCEEDED | `SUCCEEDED` | `videoUrl: task.output[0]` |
| FAILED | `FAILED` | `error: task.failure` |
| CANCELLED | `FAILED` | `error: 'Task was cancelled'` |
| PENDING, RUNNING, THROTTLED | `PENDING` | — |

**Error handling:** Throws on missing API key or SDK errors.

---

### klingClient.js

**File:** [`server/klingClient.js`](../server/klingClient.js)

HTTP client for PiAPI (Kling 2.6 image-to-video).

**Base URL:** `https://api.piapi.ai/api/v1`
**Auth:** `x-api-key` header with `KLING_API_KEY`

#### `startImageToVideo({ imageUrl, templateKling })`

Sends generation request with template-specific prompt, negative prompt, camera control, cfg scale, aspect ratio, mode, and duration.

| Returns | PiAPI task ID string |
|---------|---------------------|

#### `getTask(providerTaskId)`

GET request to `/task/{providerTaskId}`. Returns raw task data object.

#### `mapStatus(providerStatus)`

| Input | Output |
|-------|--------|
| `'completed'`, `'succeeded'` | `'SUCCEEDED'` |
| `'failed'`, `'error'` | `'FAILED'` |
| anything else | `'PENDING'` |

#### `extractVideoUrl(taskData)`

Navigates `taskData.output.works[0].video.resource_without_watermark` (falls back to `.resource`). Returns URL string or `null`.

---

### animatorClient.js

**File:** [`server/animatorClient.js`](../server/animatorClient.js)

HTTP client for the Python PhotoDance-style animator service.

#### `callAnimator(imagePath, driverPath, outputPath)`

| Detail | Value |
|--------|-------|
| Endpoint | `POST {ANIMATOR_SERVICE_URL}/animate` |
| Content-Type | `multipart/form-data` (manual boundary construction) |
| Parts | `source_image` (user photo), `driver_video` (template driver) |
| Timeout | 5 minutes |
| Returns | `outputPath` on success |

**Error handling:** HTTP errors, timeouts, file write errors all reject the promise.

---

### videoPostprocess.js

**File:** [`server/videoPostprocess.js`](../server/videoPostprocess.js)

Download + ffmpeg letterbox to 720×1280 (9:16 mobile).

#### `postprocessVideo(videoUrl, rawPath, outputPath)`

| Step | Action |
|------|--------|
| 1 | Download video from URL to `rawPath` |
| 2 | ffmpeg letterbox: `scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280` |
| 3 | Delete `rawPath` intermediate file |
| Returns | `outputPath` |

**ffmpeg settings:** `libx264`, `veryfast` preset, CRF 20, `+faststart` for streaming. Falls back to no audio if audio copy fails.

**Controlled by:** `POSTPROCESS_MODE` env var (`"OFF"` or `"LETTERBOX_916"`).
