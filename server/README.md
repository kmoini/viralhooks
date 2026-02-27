# SnapDance Backend

Local Express server that handles video generation — either with mock data or the real Runway API.

## Setup

```bash
cd c:\Users\ali.m\PROJECTS\SnapDance\server
npm install
npm start
```

You should see: `SnapDance server running on http://0.0.0.0:3001`

## Mock Mode vs Runway Mode

The server has two modes controlled by your `.env` file:

### Mock Mode (default — no API key needed)

```
USE_RUNWAY=false
```

Jobs finish after 4 seconds with a sample video. Great for UI development.

### Runway Mode (real AI video generation)

```
RUNWAYML_API_SECRET=rw_your_real_key_here
USE_RUNWAY=true
```

Jobs are sent to the Runway API. Requires a valid API key and credits.

**How to get your key:**
1. Go to https://app.runwayml.com/settings/api-keys
2. Create an API key
3. Paste it in your `.env` file

## Finding your LAN IP (for iPhone testing)

1. Open **Command Prompt** on your PC
2. Run: `ipconfig`
3. Look for **Wi-Fi** > **IPv4 Address** — it will be something like `192.168.1.42`
4. Update `src/services/api.ts` in the app with that IP

## Endpoints

### POST /api/animate

```json
{ "templateId": "1", "durationSeconds": 5 }
```

In Runway mode, also include:
```json
{ "templateId": "1", "durationSeconds": 5, "imageUrl": "https://example.com/photo.jpg" }
```

Returns: `{ "taskId": "abc-123-..." }`

### GET /api/task/:taskId

Returns one of:
- `{ "status": "PENDING" }`
- `{ "status": "SUCCEEDED", "videoUrl": "https://..." }`
- `{ "status": "FAILED", "error": "reason" }`
