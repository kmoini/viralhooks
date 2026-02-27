# Environment Variables

All variables defined in [`server/.env`](../server/.env), loaded via `dotenv` at startup in [`server/index.js`](../server/index.js).

---

## Mode Selection

| Variable | Purpose | Valid Values | Default |
|----------|---------|-------------|---------|
| `USE_ANIMATOR` | Enable Python Animator mode | `true`, `false` | `false` |
| `USE_RUNWAY` | Enable Runway ML mode | `true`, `false` | `false` |
| `USE_KLING` | Enable Kling 2.6 (PiAPI) mode | `true`, `false` | `false` |

**Priority:** `USE_ANIMATOR` > `USE_RUNWAY` > `USE_KLING` > Mock (fallback).

Only one mode is active at a time. If multiple are `true`, the highest-priority mode wins.

---

## API Keys

| Variable | Purpose | Required When | Validation |
|----------|---------|---------------|------------|
| `RUNWAYML_API_SECRET` | Runway ML API authentication | `USE_RUNWAY=true` | Length > 0, no placeholder strings (`PASTE`, `placeholder`, `HERE`) |
| `KLING_API_KEY` | PiAPI authentication for Kling 2.6 | `USE_KLING=true` | Must be set (checked at runtime) |

---

## Networking

| Variable | Purpose | Valid Values | Default |
|----------|---------|-------------|---------|
| `PUBLIC_BASE_URL` | Public tunnel URL for Kling image access | Full URL (e.g., `https://xyz.ngrok-free.dev`) | None — **required** if `USE_KLING=true` |

**Notes:**
- Must match the current ngrok tunnel URL (changes on each restart)
- Used to construct publicly-accessible image URLs for PiAPI
- Format: `{PUBLIC_BASE_URL}/uploads/{filename}`
- Throws error at runtime if missing when Kling mode is active

---

## Post-Processing

| Variable | Purpose | Valid Values | Default |
|----------|---------|-------------|---------|
| `POSTPROCESS_MODE` | Video post-processing strategy (Runway only) | `OFF`, `LETTERBOX_916` | `OFF` |

- `OFF` — Return raw Runway video URL directly
- `LETTERBOX_916` — Download + ffmpeg letterbox to 720×1280 (9:16 mobile aspect ratio)

---

## Services

| Variable | Purpose | Valid Values | Default |
|----------|---------|-------------|---------|
| `ANIMATOR_SERVICE_URL` | Python animator service endpoint | HTTP URL | `http://localhost:8000` |

---

## Summary

```env
# Mode flags (only one active at a time, priority: ANIMATOR > RUNWAY > KLING > MOCK)
USE_ANIMATOR=false
USE_RUNWAY=false
USE_KLING=true

# API keys
RUNWAYML_API_SECRET=key_...
KLING_API_KEY=1f15...

# Networking
PUBLIC_BASE_URL=https://xyz.ngrok-free.dev

# Post-processing
POSTPROCESS_MODE=OFF

# Services
ANIMATOR_SERVICE_URL=http://localhost:8000
```
