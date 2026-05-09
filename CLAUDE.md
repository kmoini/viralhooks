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
| Domain | viralhooks.app — DNS via Hostinger (nameservers: `dns-parking.com`) |

## Deploy

```bash
cd C:\PROJECTS\viralhooks && vercel --prod --yes
```

No gate script. No build step. Vercel deploys the working tree directly.

To push to GitHub (needs PAT for kmoini/viralhooks — old PAT was rotated):
```bash
git push https://<PAT>@github.com/kmoini/viralhooks.git master
```

**DNS note:** nameservers are Hostinger, not Vercel. `vercel dns add` is silently ignored — DNS changes must go through the Hostinger web panel.

## File conventions

- **Plain JS only** — no TypeScript, no bundler. All JS is IIFEs in `/js/`.
- **`js/app.js`** — main hook generator: form submit → `POST /api/hooks/generate` → renders `.hook-card` elements with copy buttons and a "Generate with my face →" link to `snapdance.app/dance/<templateId>`.
- **`js/niche.js`** — copy button handler for `.btn-copy-small` elements on niche pages only.
- **`css/styles.css`** — global design tokens and all shared components. Also contains `.niche-pages` and `.niche-page-links` for the homepage niche link grid.
- **`css/niche.css`** — layout styles used exclusively by niche landing pages. Key classes: `.niche-hero`, `.example-hooks`, `.niche-guide`, `.niche-generator`, `.niche-nav`.
- **`esc(str)`** in `app.js` — always use for user-sourced strings inserted into `innerHTML`.

## Page structure (14 pages)

Each niche page has these sections in order:

1. **`.niche-hero`** — breadcrumb + H1 + hero subtitle
2. **`.example-hooks`** — grid of 20 pre-written hooks with copy buttons
3. **`.niche-guide`** — ~250 words explaining what hook formats work for this niche, which sub-niches are trending, and how to apply the hooks. Added 2026-05-05. Use `<h2>Why These Hooks Work for [Niche] Creators</h2>` as the heading.
4. **`.niche-generator`** — AI generator form (pre-filled via `data-preset-niche` on `<body>`)
5. **`#results`** — hidden until generation
6. **`.faq`** — 3 niche-specific FAQ items with `<details>` elements
7. **`.niche-nav`** — links to all 12 other niche pages + `/tiktok-hook-examples`

**Homepage (`index.html`)** additionally has a **`.niche-pages`** section (between `.differentiator` and `.faq`) with a `.niche-page-links` grid linking to all 13 niche pages. This is the only crawlable outbound link structure from the homepage to niche pages — the chips above the generator are `<button>` elements (JS quick-fill only, not crawlable).

## Adding a new niche page

1. Copy an existing niche page (e.g. `tiktok-hooks-fitness.html`)
2. Change `data-preset-niche` on `<body>` — pre-fills the generator input
3. Update: `<title>`, meta description, keywords, canonical URL, og tags, FAQPage JSON-LD, H1, hero sub
4. Replace all 20 hooks with niche-specific ones
5. Write a `.niche-guide` section (~250 words): what hook formats dominate this niche, which sub-niches perform best, how to combine hooks with video format
6. Update FAQ (3 questions specific to the niche)
7. Update generator placeholder text
8. Add the new page to `sitemap.xml` (priority `0.8`)
9. Add a link to the new page in every other niche page's `.niche-nav`
10. Add a link to the new page in the homepage `.niche-page-links` grid
11. Add a link in `tiktok-hook-examples.html` `.niche-nav`
12. Deploy: `vercel --prod --yes`

Each niche page loads both `/js/app.js` and `/js/niche.js`.

## Internal linking architecture

The site has a three-layer link structure (critical for SEO PageRank flow):

- **Homepage → niche pages:** `.niche-pages` section with `.niche-page-links` grid (crawlable `<a>` tags)
- **Niche page → other niche pages:** `.niche-nav` at the bottom of every niche page links to all 12 siblings + `/tiktok-hook-examples`
- **Examples page → niche pages:** `.niche-nav` links to all 13 niche pages

When adding a new niche page, all three layers must be updated or the new page will be orphaned from the link graph.

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
| `/tiktok-hooks-skincare` | "tiktok hooks for skincare" |
| `/tiktok-hooks-coaches` | "tiktok hooks for coaches" |
| `/tiktok-hooks-small-business` | "tiktok hooks for small business" |
| `/tiktok-hooks-finance` | "tiktok hooks for finance" |
| `/tiktok-hooks-cooking` | "tiktok hooks for cooking" |
| `/tiktok-hooks-fashion` | "tiktok hooks for fashion" |
| `/tiktok-hooks-travel` | "tiktok hooks for travel" |
| `/tiktok-hooks-parenting` | "tiktok hooks for parenting" |
| `/tiktok-hooks-coding` | "tiktok hooks for coding" |
| `/tiktok-hooks-mental-health` | "tiktok hooks for mental health" |

## SEO rules

- Every page must have: `<title>`, `<meta name="description">`, `<link rel="canonical">`, `og:*` tags, and a `FAQPage` JSON-LD block.
- `cleanUrls: true` in `vercel.json` serves `.html` files at clean paths. Canonical URLs must use the clean form (no `.html`).
- `sitemap.xml` must be updated whenever a page is added.
- GSC verified via HTML tag (URL prefix property `https://viralhooks.app/`). The `<meta name="google-site-verification" ...>` tag in `index.html` must not be removed.
