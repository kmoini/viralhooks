# Hooks

## Current State

The project does not yet have custom hooks extracted into dedicated files. All state and side effects live inline in screen components. This documents the current patterns and planned extraction points.

---

## Inline Hook Usage by Screen

### UploadScreen

| Hook | Purpose |
|------|---------|
| `useState<string \| null>(null)` | Track selected image URI (`imageUri`) |
| `useState<boolean>(false)` | Track submission loading state (`submitting`) |
| `useRoute()` | Read `template` from navigation params |
| `useNavigation()` | Navigate to `Generating` screen |

**Side effects:** Image picker launch, API call (`startAnimateWithImage`), navigation on success.

### GeneratingScreen

| Hook | Purpose |
|------|---------|
| `useRef<boolean>(false)` | Guard against duplicate navigation (`doneRef`) |
| `useRoute()` | Read `taskId` from navigation params |
| `useNavigation()` | Navigate to `Result` or go back |
| `useEffect()` | Set up 2-second polling interval, cleanup on unmount |

**Side effects:** `setInterval` polling `getTask(taskId)` every 2 seconds.

### ResultScreen

| Hook | Purpose |
|------|---------|
| `useState<string \| null>(null)` | Cache downloaded video local URI (`localUri`) |
| `useState<boolean>(false)` | Track save-in-progress state (`saving`) |
| `useRoute()` | Read `videoUrl` from navigation params |
| `useNavigation()` | Navigate to `Home` |

**Side effects:** Video download to cache, save to camera roll, system share.

### HomeScreen

No hooks beyond the implicit render. Delegates everything to `TemplateGrid`.

---

## Planned Custom Hooks

When complexity grows, extract these:

| Hook Name | State Managed | Side Effects | Consumers |
|-----------|--------------|--------------|-----------|
| `useUploadSelfie` | `imageUri`, `submitting` | Pick image, upload via API | UploadScreen |
| `useGenerationStatus` | `status`, `videoUrl`, `error` | Poll `getTask()` every 2s | GeneratingScreen |
| `useVideoPlayer` | `localUri`, `saving` | Download, save, share | ResultScreen |
| `useTemplates` | `templates[]` | Fetch from API (future) | HomeScreen / TemplateGrid |

These are extraction targets — implement only when the screen logic becomes complex enough to warrant separation.
