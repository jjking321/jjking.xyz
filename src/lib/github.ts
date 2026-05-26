// Thin wrapper around GitHub's Contents API. Used by the admin to write
// content + image files back to the repo, which triggers a Vercel rebuild.
//
// Env vars expected:
//   GITHUB_TOKEN  — PAT with `repo` scope (fine-grained: Contents read+write)
//   GITHUB_REPO   — "owner/name", e.g. "jjking/jjking.xyz"
//   GITHUB_BRANCH — defaults to "main"
//
// In dev (no token set), writes fall back to local filesystem so you can
// iterate without a real repo.

import fs from 'node:fs/promises';
import path from 'node:path';

const REPO = () => process.env.GITHUB_REPO ?? '';
const BRANCH = () => process.env.GITHUB_BRANCH ?? 'main';
const TOKEN = () => process.env.GITHUB_TOKEN ?? '';

const API = 'https://api.github.com';

function ghHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${TOKEN()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  } as Record<string, string>;
}

function isLive(): boolean {
  return Boolean(TOKEN() && REPO());
}

/** Resolve a project-relative path to its absolute filesystem path. */
function fsPath(repoPath: string): string {
  return path.resolve(process.cwd(), repoPath);
}

/** Fetch a file's current SHA + content (base64). Returns null if missing. */
export async function getFile(repoPath: string): Promise<{ sha: string; content: string } | null> {
  if (!isLive()) {
    try {
      const buf = await fs.readFile(fsPath(repoPath));
      return { sha: '', content: buf.toString('base64') };
    } catch {
      return null;
    }
  }
  const r = await fetch(
    `${API}/repos/${REPO()}/contents/${encodeURI(repoPath)}?ref=${encodeURIComponent(BRANCH())}`,
    { headers: ghHeaders() }
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`github get ${repoPath}: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { sha: string; content: string };
  return { sha: j.sha, content: j.content };
}

/** Decode base64 content (handles GitHub's line-wrapped output). */
export function decodeContent(b64: string): string {
  return Buffer.from(b64.replace(/\n/g, ''), 'base64').toString('utf8');
}

/** Write or update a file. `content` is a UTF-8 string OR a base64 string for binary. */
export async function putFile(opts: {
  repoPath: string;
  message: string;
  content: string;
  isBinaryBase64?: boolean;
}): Promise<void> {
  const { repoPath, message, content, isBinaryBase64 } = opts;
  const contentB64 = isBinaryBase64 ? content : Buffer.from(content, 'utf8').toString('base64');

  if (!isLive()) {
    const abs = fsPath(repoPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const buf = Buffer.from(contentB64, 'base64');
    await fs.writeFile(abs, buf);
    return;
  }

  const existing = await getFile(repoPath);
  const r = await fetch(`${API}/repos/${REPO()}/contents/${encodeURI(repoPath)}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: contentB64,
      branch: BRANCH(),
      ...(existing?.sha ? { sha: existing.sha } : {}),
    }),
  });
  if (!r.ok) throw new Error(`github put ${repoPath}: ${r.status} ${await r.text()}`);
  await triggerRedeploy();
}

/** Delete a file. No-op if missing. */
export async function deleteFile(repoPath: string, message: string): Promise<void> {
  if (!isLive()) {
    try {
      await fs.unlink(fsPath(repoPath));
    } catch {
      // ignore
    }
    return;
  }
  const existing = await getFile(repoPath);
  if (!existing) return;
  const r = await fetch(`${API}/repos/${REPO()}/contents/${encodeURI(repoPath)}`, {
    method: 'DELETE',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha: existing.sha, branch: BRANCH() }),
  });
  if (!r.ok && r.status !== 404)
    throw new Error(`github delete ${repoPath}: ${r.status} ${await r.text()}`);
  await triggerRedeploy();
}

/** True if running against a real GitHub repo (vs. local fs fallback). */
export function isGithubLive(): boolean {
  return isLive();
}

/**
 * Trigger a Vercel rebuild after a commit. Two-step strategy:
 *  1) If `VERCEL_DEPLOY_HOOK` is set (project linked to a git source), ping it.
 *  2) Otherwise fall back to creating a deployment via the Vercel REST API
 *     using `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` and pulling from GitHub.
 *
 * Best-effort: failures are logged but don't break the commit.
 */
export async function triggerRedeploy(): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK;
  if (hook) {
    try {
      await fetch(hook, { method: 'POST' });
      return;
    } catch (e) {
      console.warn('[deploy] hook ping failed:', (e as Error).message);
    }
  }

  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) {
    console.warn('[deploy] no VERCEL_DEPLOY_HOOK or VERCEL_TOKEN — skipping auto-rebuild');
    return;
  }
  try {
    const body = {
      name: 'admin-commit',
      project: projectId,
      target: 'production',
      gitSource: {
        type: 'github',
        repo: REPO(),
        ref: BRANCH(),
      },
    };
    const url = `https://api.vercel.com/v13/deployments${teamId ? `?teamId=${teamId}` : ''}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.warn(`[deploy] api responded ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
  } catch (e) {
    console.warn('[deploy] api call failed:', (e as Error).message);
  }
}

/**
 * List the entries in a directory. Returns an array of { name, type, sha }
 * where type is 'file' or 'dir'. Empty array if the directory doesn't exist.
 */
export async function listDir(
  repoPath: string
): Promise<Array<{ name: string; type: 'file' | 'dir'; sha: string }>> {
  if (!isLive()) {
    try {
      const dirents = await fs.readdir(fsPath(repoPath), { withFileTypes: true });
      return dirents.map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ('dir' as const) : ('file' as const),
        sha: '',
      }));
    } catch {
      return [];
    }
  }
  const r = await fetch(
    `${API}/repos/${REPO()}/contents/${encodeURI(repoPath)}?ref=${encodeURIComponent(BRANCH())}`,
    { headers: ghHeaders() }
  );
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`github list ${repoPath}: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as Array<{ name: string; type: string; sha: string }>;
  if (!Array.isArray(j)) return [];
  return j.map((e) => ({ name: e.name, type: e.type as 'file' | 'dir', sha: e.sha }));
}
