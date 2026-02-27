# CLAUDE.md — SnapDance Development Rules

> **This file contains rules and instructions only.**
> For architecture and implementation details, see [`/docs`](docs/).

---

## 1. Coding Rules & Conventions

### General

- TypeScript everywhere — no `implicit any`
- Functional React components only (no class components)
- Use hooks for state and side effects
- No business logic inside UI components — delegate to hooks and services
- Service layer handles all API calls
- `async`/`await` only — no `.then()` chains
- Validate all external API responses with types

### Expo / React Native

- Screens are thin containers — delegate logic to hooks/services
- Use `useMemo` and `useCallback` for heavy video/animation data
- No inline styles except for dynamic runtime values (e.g., video dimensions)
- All static styles use `StyleSheet.create()`
- Use `SafeAreaView` on all top-level screens

### Backend (Node/Express)

- Controller → service → external API pattern
- No external API calls inside route handlers — use client modules (`runwayClient`, `klingClient`, `animatorClient`)
- Input validation on every route (reject invalid `durationSeconds`, missing `templateId`)
- Store temporary media in `server/uploads/` with UUID filenames
- Cleanup: delete intermediate files (e.g., `_raw.mp4`) after processing
- All env vars loaded via `dotenv` at startup

### Naming Conventions

| Pattern | Usage | Example |
|---------|-------|---------|
| `*Screen.tsx` | Screen components | `UploadScreen.tsx` |
| `use*` | Custom hooks | `useGenerationStatus` |
| `*Service.ts` | Frontend service layer | `generationService.ts` |
| `*Client.js` | Backend API client modules | `klingClient.js` |
| `danceTemplates.*` | Template definitions | `danceTemplates.js`, `danceTemplates.ts` |

---

## 2. Appearance & Styling Standards

- Single source of truth for visual values (currently inline `StyleSheet` — migrate to `/theme` when created)
- 8-pt spacing grid for padding and margins
- Rounded cards (`borderRadius: 8`) for templates and containers
- Dark buttons: `backgroundColor: '#111'`, white text
- Light screen backgrounds: `#f5f5f5` or `#fff`
- Border/divider color: `#e6e6e6`
- Dark mode is the target default (not yet implemented)
- Animation preview cards must use the same layout across all screens
- **Never introduce new colors, font sizes, or spacing values outside established tokens.**

---

## 3. Exceptions & Edge Cases

### Allowed Exceptions

- Inline styles permitted **only** for runtime video dimensions
- Temporary debug UI allowed behind `__DEV__` flag
- Fallback to static thumbnail if animated preview fails
- Mock generation service allowed in development mode (`USE_KLING=false`, `USE_RUNWAY=false`)

### Platform-Specific

- iOS: requires local video compression before upload (when implemented)
- Android: requires file URI normalization for `expo-file-system`
- Both: request media library permissions before save/share

---

## 4. Media Generation Rules (SnapDance-Specific)

These rules apply to all video generation providers (Runway, Kling, Animator):

1. **Preserve user identity** — no face alteration, aging, de-aging, or body reshaping
2. **Do not change** background, clothing, or lighting from the input selfie
3. **Only animate motion** — head, shoulders, hands, torso movement
4. **Keep camera framing identical** to input (static camera, no zoom, no pan, no reframe)
5. **Max preview duration:** 5 seconds
6. **Template-driven prompts only** — no free-form user text generation
7. **Prompts must be SHORT and POSITIVE** — negative/"do not" instructions make results worse
8. **Runway prompt limit:** 1000 characters max
9. **Runway model:** `gen3a_turbo` only (`gen3a` causes 500 errors)
10. **Runway unsupported params:** `motionStrength`, `guidanceScale`, `seed`, `negativePrompt`, `cameraMotion`
11. **Kling requires** publicly accessible image URL (ngrok tunnel + `PUBLIC_BASE_URL`)

---

## 5. Documentation Requirements

Claude must:

- **Read `/docs`** before making structural changes
- **Update the relevant `/docs/*.md` file** whenever it:
  - Adds a screen
  - Adds or changes a hook
  - Modifies a service or client module
  - Adds a dance template
  - Changes API routes or request/response shapes
  - Changes data models or job status lifecycle
  - Adds or changes environment variables

### Documentation Rules

| Rule | Detail |
|------|--------|
| No filler text | Every sentence must convey information |
| Use tables, bullets, code blocks | Optimize for 30-second discoverability |
| Reference real file paths | Use `file_path:line_number` format |
| Document only what exists | Do not document aspirational features as current |
| Flag discrepancies | Note when code conflicts with docs |
| Keep CLAUDE.md under 500 lines | Rules only — no architecture details |

---

## 6. Git & Workflow Rules

- Never commit `.env` files or API keys
- Never commit `node_modules/`, `.expo/`, `venv/`, or `server/uploads/`
- Commit messages: imperative mood, concise ("Add Kling template config", not "Added stuff")
- One logical change per commit
- Test backend changes with mock mode before switching to real APIs
