# Components

## Component Tree

```
App.tsx
└── AppNavigator
    ├── HomeScreen
    │   └── TemplateGrid          ← reusable
    │       └── TouchableOpacity (per template card)
    │           └── "Coming Soon" overlay (if disabled)
    ├── UploadScreen
    │   ├── Image preview
    │   └── Action buttons (Pick Photo, Submit)
    ├── GeneratingScreen
    │   └── ActivityIndicator + status text
    └── ResultScreen
        ├── Video (expo-av)
        └── Action buttons (Save, Share, Try Another)
```

## Screen Components

Screens are thin containers. They handle navigation and delegate to services/hooks.

| Screen | File | State | API Calls |
|--------|------|-------|-----------|
| HomeScreen | [`src/screens/HomeScreen.tsx`](../src/screens/HomeScreen.tsx) | None (stateless) | None |
| UploadScreen | [`src/screens/UploadScreen.tsx`](../src/screens/UploadScreen.tsx) | `imageUri`, `submitting` | `startAnimateWithImage()` |
| GeneratingScreen | [`src/screens/GeneratingScreen.tsx`](../src/screens/GeneratingScreen.tsx) | None (useRef for `doneRef`) | `getTask()` via polling |
| ResultScreen | [`src/screens/ResultScreen.tsx`](../src/screens/ResultScreen.tsx) | `localUri`, `saving` | Download, save, share via Expo APIs |

---

## Reusable Components

### TemplateGrid

| Field | Value |
|-------|-------|
| File | [`src/components/TemplateGrid.tsx`](../src/components/TemplateGrid.tsx) |
| Props | None |
| Purpose | Render dance templates in a 2-column grid |

**Implementation:**
- `FlatList` with `numColumns={2}`
- Card width calculated from `Dimensions.get('window').width`
- Enabled templates → navigate to `Upload` with `{ template }`
- Disabled templates → show "Coming Soon" overlay + alert on tap
- Data source: `danceTemplates` from [`src/config/danceTemplates.ts`](../src/config/danceTemplates.ts)

**Styling:**
- Cards: white background, `#e6e6e6` border, `borderRadius: 8`
- Overlay: `rgba(0,0,0,0.45)` semi-transparent
- Grid gap: 12px margins

---

## Components Not Yet Extracted

The following UI patterns are currently inline in screens and could be extracted:

| Pattern | Current Location | Potential Component |
|---------|-----------------|---------------------|
| Dark action button | UploadScreen, ResultScreen | `ActionButton` |
| Image preview | UploadScreen | `ImagePreview` |
| Video player | ResultScreen | `VideoPlayer` |
| Loading spinner + text | GeneratingScreen | `ProgressIndicator` |

These are noted for reference — extract only when reuse is needed.
