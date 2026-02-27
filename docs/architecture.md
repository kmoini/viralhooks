# Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile app | Expo (React Native) | 54.0.33 |
| UI framework | React | 19.1.0 |
| Navigation | React Navigation (native-stack) | 7.x |
| HTTP client | Axios | 1.13.5 |
| Backend | Node.js + Express | 4.21.0 |
| File upload | Multer | 2.0.2 |
| Image processing | Sharp | 0.34.5 |
| Video post-processing | ffmpeg (via ffmpeg-static) | 5.3.0 |
| Video generation (primary) | Kling 2.6 via PiAPI | HTTP API |
| Video generation (alt) | Runway ML gen3a_turbo | SDK 3.11.0 |
| Video generation (alt) | Python Animator service | HTTP API |

## Folder Structure

```
SnapDance/
├── App.tsx                        # Root component → renders AppNavigator
├── index.js                       # Entry point → registerRootComponent
├── package.json                   # Frontend dependencies
├── tsconfig.json                  # Extends expo/tsconfig.base
├── metro.config.js                # Blocks server/ from Metro bundler
│
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx       # Stack navigator (Home → Upload → Generating → Result)
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Template grid display
│   │   ├── UploadScreen.tsx       # Image picker + submit
│   │   ├── GeneratingScreen.tsx   # Polling status with spinner
│   │   └── ResultScreen.tsx       # Video playback + save/share
│   ├── components/
│   │   └── TemplateGrid.tsx       # 2-column FlatList of dance templates
│   ├── services/
│   │   ├── api.ts                 # Axios instance (base URL config)
│   │   └── jobs.ts                # startAnimateWithImage(), getTask()
│   ├── config/
│   │   └── danceTemplates.ts      # 10 templates (6 enabled, 4 coming soon)
│   └── types/
│       └── DanceTemplate.ts       # { id, title, enabled }
│
├── server/
│   ├── index.js                   # Express app, routes, mode selection, startup
│   ├── runwayClient.js            # Runway SDK wrapper
│   ├── klingClient.js             # PiAPI HTTP client for Kling 2.6
│   ├── animatorClient.js          # Python animator HTTP client
│   ├── danceTemplates.js          # 6 server-side template configs with prompts
│   ├── videoPostprocess.js        # ffmpeg letterbox to 720×1280
│   ├── package.json               # Backend dependencies
│   ├── .env                       # API keys and mode flags (not committed)
│   ├── uploads/                   # User-uploaded images (UUID filenames)
│   ├── public/videos/             # Generated video output
│   └── drivers/                   # Template driver videos (for Animator)
│
└── animator_service/              # Python PhotoDance-style service (separate)
```

## Data Flow

```
User (mobile app)
  │
  ├─ 1. Select dance template (HomeScreen → TemplateGrid)
  │
  ├─ 2. Pick selfie photo (UploadScreen → expo-image-picker)
  │
  ├─ 3. POST /api/animate (multipart: image + templateId)
  │     │
  │     └─ server/index.js
  │        ├─ Save image to server/uploads/{uuid}.jpg
  │        ├─ Select mode: Animator > Runway > Kling > Mock
  │        ├─ Dispatch to provider client
  │        │   ├─ klingClient.startImageToVideo()   → PiAPI task
  │        │   ├─ runwayClient.startImageToVideo()   → Runway task
  │        │   ├─ animatorClient.callAnimator()      → Python service
  │        │   └─ Mock: setTimeout(4s)
  │        └─ Return { taskId }
  │
  ├─ 4. Poll GET /api/task/:taskId every 2s (GeneratingScreen)
  │     │
  │     └─ server/index.js
  │        ├─ Check in-memory job store
  │        ├─ If PENDING → query provider API for updated status
  │        ├─ If SUCCEEDED → return { status, videoUrl }
  │        └─ If FAILED → return { status, error }
  │
  └─ 5. Play video + save/share (ResultScreen)
        ├─ expo-av for playback
        ├─ expo-file-system to download to cache
        ├─ expo-media-library to save to camera roll
        └─ expo-sharing for system share sheet
```

## Job Status Lifecycle

```
PENDING ──────────────────┐
  │                       │
  ├─ Provider returns     │ Provider returns
  │  success + video URL  │  failure/error
  │                       │
  ▼                       ▼
SUCCEEDED              FAILED
  │
  └─ (Runway only, if POSTPROCESS_MODE=LETTERBOX_916)
     ├─ Download raw video
     ├─ ffmpeg letterbox to 720×1280
     └─ Save to public/videos/
```

## Mode Selection Priority

```javascript
if (USE_ANIMATOR === 'true')           → Animator mode
else if (USE_RUNWAY === 'true' && key) → Runway mode
else if (USE_KLING === 'true')         → Kling mode
else                                   → Mock mode (4s delay, sample video)
```
