export const prerender = false;
import type { APIRoute } from 'astro';
import { getCollectionMeta } from '@lib/collections-meta';
import { putFile } from '@lib/github';
import { slugify } from '@lib/content-io';

/**
 * Image upload. The browser pre-compresses the image (see /admin/index.astro)
 * so payloads stay under Vercel's 4.5 MB function limit.
 *
 * Body: multipart/form-data with `file` and `collection` fields.
 * Returns: { path: "./assets/kebab-name.jpg" } — the relative path the
 *          collection's JSON should reference for its `image` field.
 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');
  const collection = String(form.get('collection') ?? '');
  const filenameHint = String(form.get('filename') ?? '');
  if (!(file instanceof File)) return new Response('missing file', { status: 400 });
  const meta = getCollectionMeta(collection);
  if (!meta) return new Response('unknown collection', { status: 400 });

  const orig = filenameHint || file.name || 'upload.jpg';
  const dot = orig.lastIndexOf('.');
  const ext = (dot > -1 ? orig.slice(dot + 1) : 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = slugify(orig.slice(0, dot > -1 ? dot : orig.length));
  // Append a short timestamp suffix so re-uploads don't collide
  const suffix = Date.now().toString(36).slice(-4);
  const finalName = `${base}-${suffix}.${ext}`;
  const repoPath = `${meta.assetsDir}/${finalName}`;

  const buf = new Uint8Array(await file.arrayBuffer());
  const b64 = Buffer.from(buf).toString('base64');

  await putFile({
    repoPath,
    message: `admin: upload ${collection}/${finalName}`,
    content: b64,
    isBinaryBase64: true,
  });

  // Relative path that JSON entries use to reference an image. The assets
  // dir is conventionally a sibling of the collection's content dir, so
  // a relative `./assets/<name>` works from within a JSON entry file.
  const isSiblingAssets = meta.assetsDir === `${meta.contentDir}/assets`;
  const relPath = isSiblingAssets ? `./assets/${finalName}` : `./${finalName}`;

  return new Response(JSON.stringify({ ok: true, path: relPath, repoPath }), {
    headers: { 'content-type': 'application/json' },
  });
};
