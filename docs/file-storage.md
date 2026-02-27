# File Storage

## Directory Layout

```
server/
├── uploads/           # User-uploaded selfie images
├── public/
│   └── videos/        # Generated/post-processed video output
└── drivers/           # Template driver videos (read-only reference)
```

All directories are created on server startup if they don't exist ([`server/index.js`](../server/index.js)).

---

## Upload Path

| Detail | Value |
|--------|-------|
| Directory | `server/uploads/` |
| Served at | `/uploads/<filename>` (Express static) |
| Naming | `{crypto.randomUUID()}{originalExtension}` (e.g., `a1b2c3d4.jpg`) |
| Max size | 50 MB (Multer config) |
| Accepted types | Any (no MIME filter — relies on client sending JPEG/PNG) |
| Cleanup | None — files persist until manual deletion |

**Public access:** Required for Kling mode. The image URL is constructed as:
```
{PUBLIC_BASE_URL}/uploads/{filename}
```
This URL is sent to PiAPI so Kling can fetch the image.

---

## Video Output Path

| Detail | Value |
|--------|-------|
| Directory | `server/public/videos/` |
| Served at | `/videos/<filename>` (Express static) |
| Naming | `{taskId}.mp4` |
| Cleanup | None — files persist until manual deletion |

**Sources by mode:**

| Mode | How video arrives |
|------|-------------------|
| Animator | Written directly by Python service via `callAnimator()` |
| Runway (postprocess OFF) | Not stored locally — raw Runway URL returned |
| Runway (postprocess ON) | Downloaded as `{taskId}_raw.mp4`, ffmpeg'd to `{taskId}.mp4`, raw deleted |
| Kling | Downloaded from PiAPI URL to `{taskId}.mp4` |
| Mock | Not stored — uses hardcoded sample URL |

---

## Driver Videos

| Detail | Value |
|--------|-------|
| Directory | `server/drivers/` |
| Purpose | Reference motion videos for Animator mode |
| Files | `shoulder_pop.mp4`, `side_to_side_groove.mp4`, `two_step_hand_wave.mp4`, `head_nod_finger_snap.mp4`, `hip_sway.mp4`, `jump_bounce.mp4` |
| Access | Read-only, never modified at runtime |

---

## Intermediate Files

| File Pattern | Created By | Deleted By | Purpose |
|-------------|-----------|-----------|---------|
| `{taskId}_raw.mp4` | `videoPostprocess.js` download step | `videoPostprocess.js` after ffmpeg | Unprocessed Runway video before letterbox |
| `{imagePath}_fixed{ext}` | `ensureRunwayAspectRatio()` in `index.js` | Not cleaned up (bug) | Cropped image for Runway aspect ratio compliance |

---

## Client-Side File Storage

| Operation | Library | Path | Cleanup |
|-----------|---------|------|---------|
| Video download | `expo-file-system` | `FileSystem.cacheDirectory + 'snapdance_{timestamp}.mp4'` | Managed by OS cache |
| Save to camera roll | `expo-media-library` | Device photo library | User-managed |

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Uploaded image | `{uuid}{ext}` | `550e8400-e29b-41d4.jpg` |
| Generated video | `{taskId}.mp4` | `550e8400-e29b-41d4.mp4` |
| Intermediate video | `{taskId}_raw.mp4` | `550e8400-e29b-41d4_raw.mp4` |
| Aspect-fixed image | `{originalPath}_fixed{ext}` | `uploads/abc123.jpg_fixed.jpg` |
| Client cache | `snapdance_{timestamp}.mp4` | `snapdance_1709012345678.mp4` |

---

## Discrepancies

- **Aspect-ratio fixed images** are not cleaned up after Runway task creation — minor disk leak.
- **No automatic cleanup** for uploads or videos — manual intervention needed for long-running servers.
- **No CDN** — videos served directly from Express static file handler.
