# JJKing.xyz — Project context for Claude

This is JJ's personal site, built as a reusable Astro template. Hybrid output
(static pages + serverless admin), deployed to Vercel. Source of truth is the
markdown/json files in `src/content/`.

There are TWO ways content gets edited:

1. **By a human, from anywhere** — the `/admin` dashboard (password-protected).
   Phone-friendly. Commits straight to GitHub which triggers a Vercel rebuild.
2. **By Claude** — edit the files directly in `src/content/` and commit. The
   admin reads the same files, so the two workflows compose.

For first-time template setup, see `SETUP.md` (GitHub repo, PAT, Vercel env
vars).

## The "Instagram-easy" photo workflow

When JJ sends a photo in chat and says something like "add this to the gallery",
here's what to do:

1. The photo lands in `/sessions/.../uploads/` (or wherever Cowork stages uploads).
   Read the file and copy it into `src/content/photos/assets/` under a kebab-case
   name like `cocoa-beach-sunset.jpg`. Use the Bash `cp` command or the Write tool
   with binary content.
2. Create a sibling JSON file in `src/content/photos/` with the same slug
   (`cocoa-beach-sunset.json`) using this shape:

   ```json
   {
     "title": "Optional short title",
     "caption": "What JJ said about it, or leave it out",
     "location": "City, ST",
     "image": "./assets/cocoa-beach-sunset.jpg",
     "takenAt": "2026-05-22",
     "span": 1
   }
   ```

   - `image` is a **relative path** from the JSON file to the asset.
   - `span` can be 1, 2, or 3 — bumps the grid size of that photo on home/gallery.
   - Skip fields you don't know. Schema is forgiving.
3. Commit and push. Vercel auto-deploys in ~30s.

Same pattern for `src/content/art/` (use the schema in `src/content/config.ts`)
and for `src/content/apps/` and `src/content/playlists/`.

## Adding a blog post

Create `src/content/posts/some-slug.md` with frontmatter matching `_template.md`
in that folder. Set `draft: false` when ready.

## Editing page copy

Page text (home page headlines, about page body, nav labels, footer links,
etc.) lives in `src/content/pages/`. There are three files:

- `site.json` — site-wide settings: site name, owner name, tagline, email,
  location, nav menu, social links, SEO description
- `home.json` — home page section copy (eyebrows, headings, "Currently" list)
- `about.json` — about page heading/body/sidebar/CTA + the "/now" list

The Astro pages (`src/pages/index.astro`, `src/pages/about.astro`, etc.) read
from these via `getSite()` and `getPage()` in `src/lib/site.ts`. Edit the JSON
to change the copy — don't put new strings in the .astro files.

To add ANOTHER editable page, drop a new JSON file in `src/content/pages/`
and read it from the page's `.astro` file via `getPage('slug')`.

## The admin dashboard

Lives at `/admin`. Implementation notes for Claude:

- Server-rendered routes (`/admin/*` and `/api/admin/*`) opt in via
  `export const prerender = false;` — everything else stays static.
- Auth: signed-cookie session via `src/lib/auth.ts`. Password lives in the
  `ADMIN_PASSWORD` env var, never in code.
- `src/middleware.ts` guards admin routes.
- Field schemas for the admin form generator live in
  `src/lib/collections-meta.ts`. Adding a new content collection? Update
  both `src/content/config.ts` (Zod schema) and `collections-meta.ts`
  (admin form definition).
- Writes go through `src/lib/github.ts` — GitHub Contents API → commit →
  Vercel rebuild. In dev (no `GITHUB_TOKEN`), writes fall back to the local
  filesystem.
- Image uploads are compressed in the browser (`public/admin.js`,
  `compressImage()`) to fit Vercel's 4.5 MB function body limit.

## Local dev

```bash
npm install
cp .env.example .env   # fill in ADMIN_PASSWORD + ADMIN_SESSION_SECRET
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `.vercel/output/` (since the Vercel adapter is now wired up).

## Deploy

Pushing to `main` deploys to Vercel automatically. Domain: `jjking.xyz`.

## Design system

- Aesthetic: brutalist base with Y2K/weirdcore moments. See `src/styles/global.css`.
- Fonts: JetBrains Mono (body) + Times New Roman italic (display).
- Color tokens: `--bone`, `--ink`, `--electric` (accent), `--acid` (pop), `--blood` (hot).
- Dark mode: toggleable via the bottom-right button (`data-theme="dark"` on `<html>`).
- Custom cursor: only on fine-pointer devices.

## Things to NOT do without checking with JJ

- Don't change brand fonts or core color tokens without asking.
- Don't add tracking/analytics scripts.
- Don't hardcode site-specific strings (owner name, email, location, etc.) in
  `.astro` files — they go in `src/content/pages/site.json` so the admin can
  edit them and template users can swap them.
- Don't move content out of `src/content/` — Astro's content collections rely on it.
