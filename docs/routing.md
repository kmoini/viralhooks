# Routing & API Endpoints

## Navigation Stack

Defined in [`src/navigation/AppNavigator.tsx`](../src/navigation/AppNavigator.tsx).

Type: `createNativeStackNavigator<RootStackParamList>()` — all screens have `headerShown: false`.

```typescript
type RootStackParamList = {
  Home: undefined;
  Upload: { template: DanceTemplate } | undefined;
  Generating: { clipLength: number; taskId: string } | undefined;
  Result: { videoUrl: string; clipLength: number } | undefined;
};
```

## Screens

### HomeScreen

| Field | Value |
|-------|-------|
| File | [`src/screens/HomeScreen.tsx`](../src/screens/HomeScreen.tsx) |
| Route name | `Home` |
| Params | None |
| Purpose | Display the template grid for dance selection |
| Data dependencies | `danceTemplates` from [`src/config/danceTemplates.ts`](../src/config/danceTemplates.ts) |
| Navigates to | `Upload` (with selected template) |

### UploadScreen

| Field | Value |
|-------|-------|
| File | [`src/screens/UploadScreen.tsx`](../src/screens/UploadScreen.tsx) |
| Route name | `Upload` |
| Params | `{ template: DanceTemplate }` |
| Purpose | Pick selfie photo and submit for generation |
| Data dependencies | Route param `template`, `expo-image-picker` permissions |
| API calls | `startAnimateWithImage(templateId, imageUri)` → POST `/api/animate` |
| Navigates to | `Generating` (with `taskId` and `clipLength: 5`) |

### GeneratingScreen

| Field | Value |
|-------|-------|
| File | [`src/screens/GeneratingScreen.tsx`](../src/screens/GeneratingScreen.tsx) |
| Route name | `Generating` |
| Params | `{ clipLength: number, taskId: string }` |
| Purpose | Show loading spinner while polling for generation status |
| Data dependencies | Route param `taskId` |
| API calls | `getTask(taskId)` → GET `/api/task/:taskId` (every 2 seconds) |
| Navigates to | `Result` (on SUCCEEDED) or back (on FAILED) |

### ResultScreen

| Field | Value |
|-------|-------|
| File | [`src/screens/ResultScreen.tsx`](../src/screens/ResultScreen.tsx) |
| Route name | `Result` |
| Params | `{ videoUrl: string, clipLength: number }` |
| Purpose | Play generated video, offer save/share actions |
| Data dependencies | Route param `videoUrl`, `expo-av`, `expo-file-system`, `expo-media-library`, `expo-sharing` |
| Navigates to | `Home` (via "Try Another") |

---

## API Endpoints

Base URL: `http://<LAN_IP>:3001` (configured in [`src/services/api.ts`](../src/services/api.ts))

### POST /api/animate

Start a video generation job.

**Request** (multipart/form-data):

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `image` | file | Yes | User selfie photo (JPEG/PNG) |
| `templateId` | string | Yes | Dance template ID (`"1"` through `"6"`) |
| `durationSeconds` | string | Yes | Must be `"5"` |

**Response** (200):

```json
{ "taskId": "550e8400-e29b-41d4-a716-446655440000" }
```

**Errors:**

| Code | Condition |
|------|-----------|
| 400 | Missing image, invalid templateId, durationSeconds ≠ 5 |
| 500 | Provider API failure |

### GET /api/task/:taskId

Poll job status.

**Response** (200):

```json
// Pending
{ "status": "PENDING" }

// Succeeded
{ "status": "SUCCEEDED", "videoUrl": "https://.../<taskId>.mp4" }

// Failed
{ "status": "FAILED", "error": "Provider error message" }
```

**Errors:**

| Code | Condition |
|------|-----------|
| 404 | Unknown taskId |

### Static File Routes

| Route | Serves | Purpose |
|-------|--------|---------|
| `/uploads/*` | `server/uploads/` | Uploaded images (needed by Kling for public access) |
| `/videos/*` | `server/public/videos/` | Generated/post-processed videos |
