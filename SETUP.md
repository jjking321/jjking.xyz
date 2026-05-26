# Personal site + admin — setup

This template is a personal portfolio site built on Astro, deployed to Vercel,
with a built-in admin dashboard at `/admin` that lets you edit text and
upload photos from your phone or any browser. Edits commit straight back to
your GitHub repo and trigger a Vercel rebuild — no separate database, no CMS
service.

## What you need

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free Hobby tier is fine)
- Node 18+ locally if you want to run `npm run dev`

## One-time setup (~15 minutes)

### 1. Get the code on GitHub

```bash
git init
git add .
git commit -m "initial commit"
```

Create an empty repo at github.com (don't initialize with a README), then:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

### 2. Create a GitHub Personal Access Token

Go to <https://github.com/settings/tokens?type=beta> and click **Generate new token (fine-grained)**.

- **Repository access**: Only select repositories → pick the repo you just created
- **Permissions** → **Repository permissions** → **Contents**: **Read and write**
- Expiration: 1 year is fine (you'll get a reminder)

Copy the token (`github_pat_…`). You'll paste it into Vercel in step 5.

### 3. Deploy to Vercel

- Go to <https://vercel.com/new> → Import your repo
- Framework preset: **Astro** (auto-detected)
- Leave build settings default
- Click **Deploy**

The first deploy will succeed but `/admin` won't work yet — you need env vars.

### 4. Set environment variables in Vercel

Project Settings → Environment Variables. Add these five for **Production**, **Preview**, **Development**:

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | A strong password you'll use to log into `/admin`. Store in your password manager. |
| `ADMIN_SESSION_SECRET` | A 32+ char random string. Generate: `openssl rand -hex 32` |
| `GITHUB_TOKEN` | The fine-grained PAT from step 2. |
| `GITHUB_REPO` | `owner/name` of your GitHub repo (e.g. `jjking/jjking.xyz`). |
| `GITHUB_BRANCH` | `main` |

Then **Deployments → top deployment → ⋯ → Redeploy** to pick up the new env vars.

### 5. Done

Visit `https://your-site.vercel.app/admin`, log in with your password, and start editing. Every save commits to your repo and triggers a rebuild (~30s).

### 6. (Optional) Custom domain

In Vercel: Project Settings → Domains → Add. Follow Vercel's DNS instructions.

---

## How the admin works

- `/admin/login` — password gate
- `/admin` — dashboard with sections for each content collection
- Edits and uploads commit to your repo via the GitHub Contents API
- Photos are compressed in the browser before upload (max 2400px, ~85% JPEG)
  to stay under Vercel's 4.5 MB function body limit
- Vercel auto-deploys on push, so your site updates ~30s after you click Save

## Editing content from your phone

Bookmark `https://your-site.vercel.app/admin` on your phone. The admin is
mobile-friendly — you can upload photos from your camera roll, edit blog
posts, tweak page copy, etc.

## Local development

```bash
npm install
cp .env.example .env
# Fill in ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env
npm run dev
```

In local dev, if you leave `GITHUB_TOKEN` blank the admin still works — it
writes changes directly to your local filesystem instead of committing.

## Content model

All content lives in `src/content/`. Each subfolder is a "collection":

- `photos/` — photo grid (home + gallery pages)
- `art/` — art pieces
- `posts/` — blog posts (markdown)
- `playlists/` — playlist links
- `apps/` — project showcase
- `pages/` — editable text on each page
  - `site.json` — site-wide settings (nav, footer, brand, social links)
  - `home.json` — home page copy
  - `about.json` — about page copy

To add a new editable collection: add a Zod schema in `src/content/config.ts`,
then add an entry in `src/lib/collections-meta.ts` so the admin can render an
editor for it.

## Customizing the look

- Brand colors and fonts: `src/styles/global.css` (CSS variables: `--bone`,
  `--ink`, `--electric`, `--acid`, `--blood`)
- Signature image in nav/footer: `public/signature.png` + `public/signature-dark.png`
  (delete to fall back to text-only branding using the `ownerName` from `site.json`)
- Favicon: `public/favicon.svg`

## Security notes

- The admin password lives in a Vercel env var, never in code or in git.
- Session cookies are HMAC-signed with `ADMIN_SESSION_SECRET`. If you suspect
  the secret leaked, rotate it (any active sessions get logged out).
- The GitHub PAT only has access to this one repo (fine-grained scope).
- All admin routes are protected by `src/middleware.ts`.
