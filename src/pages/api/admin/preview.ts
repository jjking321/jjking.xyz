export const prerender = false;
import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getFile, isGithubLive } from '@lib/github';

/**
 * Serves a file from the repo for admin thumbnail previews. In dev, reads
 * from the local filesystem; in prod (where the function bundle doesn't
 * include the content/ assets), fetches from GitHub.
 */
export const GET: APIRoute = async ({ url }) => {
  const repoPath = url.searchParams.get('path') ?? '';
  // Only allow reading from src/content/ so we don't expose arbitrary repo paths
  if (!/^src\/content\/[A-Za-z0-9_\-./]+$/.test(repoPath) || repoPath.includes('..')) {
    return new Response('forbidden', { status: 403 });
  }
  const ext = repoPath.split('.').pop()?.toLowerCase() ?? '';
  const mime: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    avif: 'image/avif',
  };
  const contentType = mime[ext] ?? 'application/octet-stream';

  let bytes: Uint8Array | null = null;
  if (isGithubLive()) {
    const file = await getFile(repoPath);
    if (file) bytes = new Uint8Array(Buffer.from(file.content.replace(/\n/g, ''), 'base64'));
  } else {
    try {
      const buf = await fs.readFile(path.resolve(process.cwd(), repoPath));
      bytes = new Uint8Array(buf);
    } catch {
      // fall through
    }
  }
  if (!bytes) return new Response('not found', { status: 404 });
  return new Response(bytes, {
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=60',
    },
  });
};
