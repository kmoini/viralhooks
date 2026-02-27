# SnapDance App - Continuation Summary

## Current Status (as of Feb 12, 2026)

You are building **SnapDance**, a React Native + TypeScript + Expo app using **React Navigation (native stack)**.

### What's Already Built (Steps 1-3):

1. **Home Screen** - Shows a 2-column grid of 10 dance templates
   - Only Template #1 is enabled (clickable)
   - Templates #2-#10 show "Coming Soon" overlay
   - Tapping Template #1 navigates to UploadScreen

2. **UploadScreen** - Photo upload and preview
   - Shows template name at top ("Template #1")
   - Shows "Clip length: 5 seconds"
   - Button "Pick Photo" opens the image picker (expo-image-picker)
   - After picking a photo, the preview displays (300px tall, rounded corners)
   - Button "Animate (mock)" appears after a photo is selected

3. **Mock Generation Pipeline (Just Built - Step 4)**
   - Tapping "Animate (mock)" navigates to GeneratingScreen
   - GeneratingScreen shows a spinner + "Generating your 5s SnapDance…"
   - After 4 seconds, auto-navigates to ResultScreen
   - ResultScreen displays:
     - Video player (expo-av) playing a sample MP4 (w3schools bbb.mp4)
     - Button "Save to Camera Roll" (downloads MP4 and saves using expo-media-library)
     - Button "Share to Social" (downloads MP4 and opens OS share sheet using expo-sharing)
     - Button "Try Another" (navigates back to Home)

### Project Structure:

```
src/
├── components/
│   └── TemplateGrid.tsx        # 10-template 2-column grid
├── screens/
│   ├── HomeScreen.tsx          # Renders TemplateGrid
│   ├── UploadScreen.tsx        # Photo pick + preview + Animate button
│   ├── GeneratingScreen.tsx    # Spinner + 4s delay
│   └── ResultScreen.tsx        # Video play + save/share/try again
├── navigation/
│   └── AppNavigator.tsx        # React Navigation native stack
├── config/
│   └── danceTemplates.ts       # 10 template objects (id, title, enabled)
└── types/
    └── DanceTemplate.ts        # TypeScript type definition

App.tsx                          # Root component (uses AppNavigator)
package.json                     # Dependencies
```

### Key Dependencies Installed:

- `expo`, `react`, `react-native`
- `@react-navigation/native`, `@react-navigation/native-stack`
- `expo-av`, `expo-file-system`, `expo-media-library`, `expo-sharing`, `expo-image-picker`
- `react-native-screens`, `react-native-safe-area-context`
- TypeScript dev dependencies

### How to Continue Development:

When starting a fresh Claude chat, provide:

1. **Your beginner status** - "I am a beginner learning React Native step-by-step"
2. **Current task/feature** - What you want to build next (e.g., "Connect ResultScreen to a real video generation API")
3. **Constraints** - "Only one step at a time, stop and ask me to confirm before moving on"
4. **Reference this file** - Say "See the CONTINUATION_SUMMARY.md in the SnapDance project"

### Next Possible Steps (Examples - Choose One):

- **Step 5**: Connect ResultScreen to a real Runway API for video generation
- **Step 6**: Add user authentication (sign up / log in)
- **Step 7**: Create a gallery/history screen showing past generated videos
- **Step 8**: Add template customization (color, speed, effects)
- **Step 9**: Implement video trimming/editing before generation
- **Step 10**: Analytics tracking and user onboarding

### Running the App:

```bash
cd c:\Users\ali.m\PROJECTS\SnapDance

# Start the dev server
npx expo start

# Open on iOS simulator or Android emulator / Expo Go app
```

### Testing the Current Features:

1. App opens → Home screen with template grid
2. Tap Template #1 → UploadScreen
3. Tap "Pick Photo" → Choose an image
4. Preview appears → Tap "Animate (mock)"
5. Spinner screen for ~4s → Auto-navigates to video result
6. Video plays → Tap save/share/try again buttons

---

**Key Point**: You are a beginner. Always ask Claude to:
- Explain code in simple terms
- Show one file at a time
- Give step-by-step instructions
- Stop and ask you to confirm each step works before moving on
