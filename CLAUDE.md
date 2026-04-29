# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`viralhooks.app` — a free standalone TikTok hook generator. Tentpole 1 of SnapDance's growth strategy. Completely separate from the SnapDance app: **never import or copy from `C:\PROJECTS\SnapDance\website\`, `src\`, or `server\`.**

## Stack

| Layer | Detail |
|-------|--------|
| Frontend | Static HTML/CSS/JS — no framework, no build step |
| Hosting | Vercel (snap-dance team · viralhooks project) |
| API proxy | `vercel.json` rewrites `/api/*` → `snapdance-production.up.railway.app/api/$1` |
| Hook generation | `POST /api/hooks/generate` on Railway automation server (Claude Haiku, 30 req/hr per IP) |
| Domain | viralhooks.app — DNS via Hostinger hpanel.hostinger.com |

## Deploy

```bash
cd C:\PROJECTS\viralhooks && vercel --prod --yes
```

No gate script. No build step. Vercel deploys the working tree directly.

To push to GitHub (needs PAT for kmoini/viralhooks — old PAT was rotated):
```bash
git push https://<PAT>@github.com/kmoini/viralhooks.git master
```

## File conventions

- **Plain JS only** — no TypeScript, no bundler. All JS is IIFEs in `/js/`.
- **`js/app.js`** — main hook generator: form submit → `POST /api/hooks/generate` → renders `.hook-card` elements with copy buttons and a "Generate with my face →" link to `snapdance.app/dance/<templateId>`.
- **`js/niche.js`** — copy button handler for `.btn-copy-small` elements on niche pages only.
- **`css/styles.css`** — global design tokens and all shared components.
- **`css/niche.css`** — layout styles used exclusively by niche landing pages.
- **`esc(str)`** in `app.js` — always use for user-sourced strings inserted into `innerHTML`.

## Niche landing page pattern

All 7 niche pages follow the same structure. To add a new niche page:

1. Copy any existing niche page (e.g. `tiktok-hooks-fitness.html`)
2. Change `data-preset-niche` on `<body>` — this pre-fills the generator input via `app.js`
3. Update: `<title>`, meta description, keywords, canonical URL, og tags, JSON-LD FAQPage, H1, hero sub, all 20 hooks, FAQ answers, generator placeholder, niche-nav links
4. Add the new page to `sitemap.xml` (priority `0.8`)
5. Add cross-links to the new page in all other niche pages' `<nav class="niche-nav">`
6. Deploy: `vercel --prod --yes`

Each niche page loads both `/js/app.js` and `/js/niche.js`.

## API response shape

`POST /api/hooks/generate` body: `{ "niche": "fitness" }`

Response:
```json
{
  "hooks": [
    {
      "text": "Hook line here",
      "explainer": "Why this works...",
      "template": { "id": "tpl_abc123", "name": "Smooth Wave", "thumbnailVideo": "https://..." }
    }
  ]
}
```

`hook.template` may be `null` — `app.js` falls back to linking to `snapdance.app` root.

## Live pages

| URL | Target keyword |
|-----|----------------|
| `/` | "tiktok hook generator" |
| `/tiktok-hook-examples` | "tiktok hook examples" |
| `/tiktok-hooks-fitness` | "tiktok hooks for fitness" |
| `/tiktok-hooks-real-estate` | "tiktok hooks for real estate" |
| `/tiktok-hooks-coaches` | "tiktok hooks for coaches" |
| `/tiktok-hooks-skincare` | "tiktok hooks for skincare" |
| `/tiktok-hooks-small-business` | "tiktok hooks for small business" |
| `/tiktok-hooks-finance` | "tiktok hooks for finance" |
| `/tiktok-hooks-cooking` | "tiktok hooks for cooking" |

## SEO rules

- Every page must have: `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:*` tags, and a `FAQPage` JSON-LD block.
- `cleanUrls: true` in `vercel.json` serves `.html` files at clean paths (`/tiktok-hooks-fitness` not `/tiktok-hooks-fitness.html`). Canonical URLs must use the clean form.
- `sitemap.xml` must be updated whenever a page is added.
