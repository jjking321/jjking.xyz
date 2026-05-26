# JJKing.xyz — personal site template

Personal portfolio site of JJ King. Built with [Astro](https://astro.build/),
deployed to Vercel, with a built-in admin dashboard so you can edit text and
upload photos from any browser (including your phone). Designed to be forked
as a template for your own portfolio.

## Forking this as your own site

See **[SETUP.md](./SETUP.md)** for a 15-minute walkthrough: GitHub repo,
Personal Access Token, Vercel deploy, and env vars. Once set up, you don't
need to touch code to add content — just visit `/admin` on your site.

## Getting started locally

```bash
npm install
cp .env.example .env  # fill in ADMIN_PASSWORD + ADMIN_SESSION_SECRET
npm run dev
```

Open http://localhost:4321 (site) or http://localhost:4321/admin (dashboard).

## Project layout

```
src/
├── content/
│   ├── photos/      # JSON entries + assets/ for images
│   ├── art/         # JSON entries + assets/ for images
│   ├── posts/       # Markdown blog posts
│   ├── playlists/   # JSON entries
│   ├── apps/        # JSON entries
│   └── pages/       # site.json (global) + per-page copy
├── lib/             # auth, github API, site helpers
├── pages/
│   ├── admin/       # admin dashboard (server-rendered)
│   ├── api/admin/   # admin API endpoints (server-rendered)
│   └── ...          # public pages (static)
├── components/      # Nav, Footer, Cursor, etc.
├── layouts/         # Base.astro — page chrome
├── middleware.ts    # auth guard for /admin and /api/admin
└── styles/global.css
```

## Adding content

**With the admin (recommended):** visit `/admin`, log in, click the
collection you want, hit `+ New`.

**Manually:** drop a file into the right `src/content/` subfolder using the
sibling `_template.json` (or `_template.md`) as a guide.

See `CLAUDE.md` for the photo-drop workflow when working with Claude.

## Deploy

Push to `main`. Vercel auto-deploys in ~30s.

## License

Code MIT. Content © its respective owner — content placed by you stays yours.
