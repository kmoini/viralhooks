# SnapDance App - Continuation Summary

## Current Status (as of Feb 27, 2026)

You are building **SnapDance**, a React Native + TypeScript + Expo app using **React Navigation (native stack)**.

---

## What's Already Built (Steps 1–4 + backend):

### Frontend (Steps 1–4 complete)

1. **HomeScreen** — 2-column grid of 10 dance templates
   - Only Template #1 is enabled (clickable); #2–#10 show "Coming Soon" overlay
   - Tapping Template #1 navigates to UploadScreen

2. **UploadScreen** — Photo upload and preview
   - Shows template name + "Clip length: 5 seconds"
   - "Pick Photo" opens expo-image-picker
   - Preview displays after picking (300px tall, rounded corners)
   - "Animate" button appears after photo is selected

3. **GeneratingScreen** — Polls backend until done
   - Calls `POST /api/animate` with image + templateId + durationSeconds
   - Polls `GET /api/task/:taskId` every 3s until status is SUCCEEDED or FAILED
   - Shows spinner + "Generating your 5s SnapDance…"
   - Auto-navigates to ResultScreen when SUCCEEDED

4. **ResultScreen** — Video playback + actions
   - expo-av video player (plays the Cloudinary URL returned by backend)
   - "Save to Camera Roll" — downloads + saves via expo-media-library
   - "Share to Social" — downloads + opens OS share sheet via expo-sharing
   - "Try Another" — navigates back to HomeScreen

### Backend (Node/Express — fully operational)

- **Mode**: `USE_KLING=true` (Kling 2.6 via PiAPI)
- **Port**: 3001
- **Two routes**:
  - `POST /api/animate` — accepts multipart image + templateId + durationSeconds, starts Kling job
  - `GET /api/task/:taskId` — polls Kling status, downloads MP4, uploads to Cloudinary, returns `{ status, videoUrl }`

---

## Key Architecture Decisions

### Cloudinary for everything (no ngrok dependency)

- **Selfie upload**: `POST /api/animate` uploads the selfie to Cloudinary via `cloudinaryUpload.js`
  - Cloudinary URL passed to Kling as input image (Kling requires a public URL)
- **Video output**: `GET /api/task/:taskId` Kling success path:
  1. Downloads finished MP4 from Kling to `server/public/videos/<taskId>.mp4`
  2. Uploads that local MP4 to Cloudinary via `cloudinaryVideoUpload.js`
  3. Deletes the local MP4
  4. Sets `job.videoUrl = cloudinary secure_url`
  5. Returns that Cloudinary URL to the mobile app as `videoUrl`
- Result: the mobile app gets a stable `res.cloudinary.com` URL — no ngrok needed at all

### Backend mode priority
`USE_ANIMATOR` > `USE_RUNWAY` > `USE_KLING` > Mock fallback

---

## Project File Structure

```
src/
├── components/
│   └── TemplateGrid.tsx        # 2-column template grid
├── screens/
│   ├── HomeScreen.tsx          # Renders TemplateGrid
│   ├── UploadScreen.tsx        # Photo pick + preview + Animate button
│   ├── GeneratingScreen.tsx    # Spinner + polls backend
│   └── ResultScreen.tsx        # Video play + save/share/try again
├── navigation/
│   └── AppNavigator.tsx        # React Navigation native stack
├── config/
│   └── danceTemplates.ts       # 10 template objects (id, title, enabled)
├── services/
│   ├── api.ts                  # Axios instance — base URL: 192.168.2.75:3001
│   └── jobs.ts                 # startAnimateWithImage(), getTask()
└── types/
    └── DanceTemplate.ts        # TypeScript type

server/
├── index.js                    # Express server (462 lines), 2 routes
├── danceTemplates.js           # Server-side templates with Kling prompts
├── klingClient.js              # PiAPI HTTP client
├── cloudinaryUpload.js         # Selfie → Cloudinary (image)
├── cloudinaryVideoUpload.js    # MP4 → Cloudinary (video) ← NEW
├── runwayClient.js             # Runway gen3a_turbo client (unused when USE_KLING)
├── animatorClient.js           # Python reenactment pipeline client (unused)
├── videoPostprocess.js         # ffmpeg letterbox post-processing
├── drivers/                    # Driver videos for Animator mode
├── public/videos/              # Temp MP4 landing spot (deleted after Cloudinary upload)
└── uploads/                    # Selfie landing spot (deleted after Cloudinary upload)

App.tsx                         # Root — renders AppNavigator
```

---

## Environment Variables (server/.env)

```
USE_KLING=true
KLING_API_KEY=<piapi key>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
POSTPROCESS_MODE=OFF
# PUBLIC_BASE_URL no longer needed (Cloudinary replaced ngrok for video serving)
```

---

## Running the App

```bash
# Terminal 1 — backend
cd d:/Apps/PROJECTS/SnapDance/server
node index.js

# Terminal 2 — frontend
cd d:/Apps/PROJECTS/SnapDance
npx expo start
```

---

## Next Possible Steps (choose one)

- **Step 5**: Enable more dance templates (add Kling prompts in `server/danceTemplates.js`, set `enabled: true` in `src/config/danceTemplates.ts`)
- **Step 6**: User authentication (sign up / log in)
- **Step 7**: Gallery/history screen showing past generated videos
- **Step 8**: Error handling improvements (show error message on ResultScreen if job fails)
- **Step 9**: Loading progress indicator (show % or elapsed time on GeneratingScreen)
- **Step 10**: Onboarding / splash screen

---

**Key Point**: You are a beginner. Always ask Claude to:
- Explain code in simple terms
- Show one file at a time
- Give step-by-step instructions
- Stop and ask you to confirm each step works before moving on
