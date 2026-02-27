# Data Models

## Frontend Types

### DanceTemplate

Defined in [`src/types/DanceTemplate.ts`](../src/types/DanceTemplate.ts).

```typescript
type DanceTemplate = {
  id: number;
  title: string;
  enabled: boolean;
};
```

Used by: `TemplateGrid`, `UploadScreen` (via navigation params), `danceTemplates.ts` config.

### RootStackParamList

Defined in [`src/navigation/AppNavigator.tsx`](../src/navigation/AppNavigator.tsx).

```typescript
type RootStackParamList = {
  Home: undefined;
  Upload: { template: DanceTemplate } | undefined;
  Generating: { clipLength: number; taskId: string } | undefined;
  Result: { videoUrl: string; clipLength: number } | undefined;
};
```

---

## Backend Models (In-Memory)

All jobs are stored in a plain JS object: `const jobs = {}`. No database. Lost on server restart.

### Job Object

The shape varies by mode. Common fields:

| Field | Type | Description |
|-------|------|-------------|
| `status` | `'PENDING' \| 'SUCCEEDED' \| 'FAILED'` | Current job state |
| `createdAt` | `number` | `Date.now()` timestamp |
| `mode` | `'animator' \| 'runway' \| 'kling' \| 'mock'` | Which provider handled this job |
| `imagePath` | `string` | Path to uploaded image in `server/uploads/` |
| `videoUrl` | `string \| undefined` | Final video URL (set on SUCCEEDED) |
| `error` | `string \| undefined` | Error message (set on FAILED) |

#### Mode-Specific Fields

**Runway mode:**

| Field | Type | Description |
|-------|------|-------------|
| `runwayTaskId` | `string` | Runway's task identifier for polling |
| `postProcessStarted` | `boolean` | Whether ffmpeg letterbox has begun |
| `croppedFile` | `string` | Filename of post-processed video |

**Kling mode:**

| Field | Type | Description |
|-------|------|-------------|
| `providerTaskId` | `string` | PiAPI task identifier for polling |
| `templateId` | `string` | Which template was used |
| `uploadedFilename` | `string` | UUID filename in uploads/ |

**Animator mode:**

| Field | Type | Description |
|-------|------|-------------|
| `outputFile` | `string` | Filename of generated video |

**Mock mode:**

| Field | Type | Description |
|-------|------|-------------|
| `videoUrl` | `string` | Hardcoded sample video URL (set after 4s) |

---

## Server-Side Template Shape

Defined in [`server/danceTemplates.js`](../server/danceTemplates.js).

```javascript
{
  name: string,              // Display name
  promptText: string,        // Runway prompt (max 1000 chars, positive only)
  driverVideo: string,       // Filename in server/drivers/
  duration: 5,               // Always 5 seconds
  ratio?: string,            // Optional Runway aspect ratio
  kling?: {                  // Optional Kling-specific config
    prompt: string,
    negativePrompt: string,
    duration: number,
    aspectRatio: string,     // e.g. '9:16'
    mode: string,            // 'pro' or 'standard'
    cfgScale: number,        // 0.0–30.0
    cameraControl: {
      type: 'simple',
      config: {
        horizontal: number,  // -1 to 1
        vertical: number,
        pan: number,
        tilt: number,
        roll: number,
        zoom: number,
      }
    }
  }
}
```

### Template Inventory

| ID | Name | Kling Config | Driver Video |
|:--:|------|:------------:|--------------|
| 1 | Shoulder Pop | Yes | `shoulder_pop.mp4` |
| 2 | Side-to-Side Groove | No (falls back to 1) | `side_to_side_groove.mp4` |
| 3 | Two-Step + Hand Wave | No (falls back to 1) | `two_step_hand_wave.mp4` |
| 4 | Head Nod + Finger Snap | No (falls back to 1) | `head_nod_finger_snap.mp4` |
| 5 | Hip Sway | No (falls back to 1) | `hip_sway.mp4` |
| 6 | Jump Bounce | No (falls back to 1) | `jump_bounce.mp4` |

---

## Relationships

```
DanceTemplate (frontend)
  │
  ├─ id maps to → server template key (string "1"–"6")
  │
  └─ Passed via navigation: HomeScreen → UploadScreen → POST /api/animate

Job (backend, in-memory)
  │
  ├─ taskId (UUID) → used by frontend polling (GET /api/task/:taskId)
  ├─ templateId → references server danceTemplates key
  ├─ imagePath → file in server/uploads/
  └─ videoUrl → file served from /videos/ or remote URL
```
