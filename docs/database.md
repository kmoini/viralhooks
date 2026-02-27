# Database / Persistence

## Current State: In-Memory Only

There is no database. All job state is stored in a plain JavaScript object in [`server/index.js`](../server/index.js):

```javascript
const jobs = {};
```

**Implications:**
- All jobs are lost on server restart
- No job history or analytics
- No concurrent instance support
- Sufficient for single-developer / demo use

---

## Job Store Schema

Key: `taskId` (UUID v4 string from `crypto.randomUUID()`)

Value: Job object (see [data-models.md](data-models.md) for full shape)

### Status Index (Conceptual)

| Status | Meaning | Terminal? |
|--------|---------|:---------:|
| `PENDING` | Job submitted, awaiting provider result | No |
| `SUCCEEDED` | Video generated and URL available | Yes |
| `FAILED` | Provider returned error or timeout | Yes |

---

## Cleanup Strategy

**Current:** None. Jobs and uploaded files accumulate until server restart or manual cleanup.

**Uploaded images** (`server/uploads/`): Persist indefinitely. No automatic deletion.

**Generated videos** (`server/public/videos/`): Persist indefinitely.

**Intermediate files** (`*_raw.mp4`): Deleted after ffmpeg post-processing (Runway mode only).

---

## Future Migration Path

If persistence is needed:

1. **SQLite** (simplest) — single-file DB, no server setup
2. **PostgreSQL** — if multi-instance or production deployment

### Proposed Schema

**jobs table:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PRIMARY KEY | `crypto.randomUUID()` |
| `user_id` | TEXT | Future auth support |
| `template_id` | TEXT NOT NULL | `"1"` through `"6"` |
| `status` | TEXT NOT NULL | `PENDING`, `SUCCEEDED`, `FAILED` |
| `mode` | TEXT NOT NULL | `animator`, `runway`, `kling`, `mock` |
| `provider_task_id` | TEXT | External task ID for polling |
| `selfie_url` | TEXT | Path to uploaded image |
| `result_url` | TEXT | Final video URL |
| `error` | TEXT | Error message on failure |
| `created_at` | TIMESTAMP | Job creation time |
| `updated_at` | TIMESTAMP | Last status change |

**Indexes:** `status`, `created_at` (for cleanup queries).

**Cleanup:** Delete jobs older than 24 hours, cascade-delete associated files.
