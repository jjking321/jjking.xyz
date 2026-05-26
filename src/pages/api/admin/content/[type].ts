export const prerender = false;
import type { APIRoute } from 'astro';
import { listItems, slugify, serializeMarkdown } from '@lib/content-io';
import { getCollectionMeta } from '@lib/collections-meta';
import { putFile } from '@lib/github';

export const GET: APIRoute = async ({ params }) => {
  const type = String(params.type ?? '');
  const meta = getCollectionMeta(type);
  if (!meta) return new Response('not found', { status: 404 });
  const items = await listItems(type);
  return new Response(JSON.stringify({ meta, items }), {
    headers: { 'content-type': 'application/json' },
  });
};

/** Create a new item. Body is JSON: { slug?, data, body? } */
export const POST: APIRoute = async ({ params, request }) => {
  const type = String(params.type ?? '');
  const meta = getCollectionMeta(type);
  if (!meta) return new Response('not found', { status: 404 });
  const payload = (await request.json()) as { slug?: string; data: Record<string, any>; body?: string };
  let slug = (payload.slug ?? '').trim();
  if (!slug) {
    const seed =
      payload.data.title || payload.data.heading || payload.data.siteName || 'item';
    slug = slugify(String(seed));
  } else {
    slug = slugify(slug);
  }
  const ext = meta.type === 'content' ? 'md' : 'json';
  const filePath = `${meta.contentDir}/${slug}.${ext}`;
  let content: string;
  if (meta.type === 'content') {
    content = serializeMarkdown(payload.data, payload.body ?? '');
  } else {
    content = JSON.stringify(payload.data, null, 2) + '\n';
  }
  await putFile({
    repoPath: filePath,
    message: `admin: create ${type}/${slug}`,
    content,
  });
  return new Response(JSON.stringify({ ok: true, slug }), {
    headers: { 'content-type': 'application/json' },
  });
};
