# Theming

## Current State

No centralized theme system exists yet. All styles are defined inline via `StyleSheet.create()` in each component/screen file. This documents the de facto visual tokens in use.

---

## Color Tokens (De Facto)

| Token | Hex | Usage |
|-------|-----|-------|
| Primary dark | `#111` | Buttons, headers |
| Background light | `#f5f5f5` | Screen backgrounds (HomeScreen) |
| Background white | `#fff` | Screen backgrounds (Upload, Result), cards |
| Border | `#e6e6e6` | Card borders, dividers |
| Text primary | `#222` | Headings |
| Text secondary | `#333` | Body text |
| Text muted | `#666`, `#999` | Subtitles, secondary labels |
| Text on primary | `#fff` | Button text on dark backgrounds |
| Overlay | `rgba(0,0,0,0.45)` | "Coming Soon" overlay on disabled cards |
| Video bg | `#000` | Video player container |

## Typography (De Facto)

| Style | Size | Weight | Color |
|-------|------|--------|-------|
| Screen header | 22 | 700 | `#222` |
| Body text | 16 | 400 | `#333` |
| Button text | 16 | 600 | `#fff` |
| Subtitle | 14 | 400 | `#666` |
| Card title | 14 | 600 | `#333` |

## Spacing (De Facto)

| Value | Usage |
|-------|-------|
| 4px | Minor internal padding |
| 8px | Small gaps |
| 12px | Grid gaps, card margins, button padding |
| 16px | Image border radius, section padding |
| 20px | Screen horizontal padding |

## Border Radius

| Value | Usage |
|-------|-------|
| 8px | Buttons, cards, video container |
| 16px | Image preview container |

## Layout Patterns

| Pattern | Implementation |
|---------|---------------|
| Full-screen container | `flex: 1` + background color |
| Safe area | `SafeAreaView` wrapper |
| Grid | `FlatList` with `numColumns={2}`, calculated card width |
| Centered loading | `alignItems: 'center'`, `justifyContent: 'center'` |

---

## Dark/Light Mode

- **Target:** Dark mode as default (not yet implemented)
- **Current:** Light backgrounds (`#f5f5f5`, `#fff`) with dark buttons (`#111`)
- When implementing: create a `ThemeProvider` with `useColorScheme()` and token maps for both modes

## Migration Path

When creating a centralized theme:

1. Create `src/theme/tokens.ts` — colors, spacing, radius, typography
2. Create `src/theme/ThemeProvider.tsx` — context + `useTheme()` hook
3. Replace hardcoded values in all `StyleSheet.create()` calls
4. Update this document with final token names
