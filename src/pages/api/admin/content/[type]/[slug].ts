export const prerender = false;
import type { APIRoute } from 'astro';
import { getItem, serializeMarkdown } from '@lib/content-io';
import { getCollectionMeta } from '@lib/collections-meta';
import { putFile, deleteFile } from '@lib/github';

export const GET: APIRoute = async ({ params }) => {
  const type = String(params.type ?? '');
  const slug = String(params.slug ?? '');
  if (!getCollectionMeta(type)) return new Response('not found', { status: 404 });
  const item = await getItem(type, slug);
  if (!item) return new Response('not found', { status: 404 });
  return new Response(JSON.stringify(item), {
    headers: { 'content-type': 'application/json' },
  });
};

/** Update an existing item. */
export const PUT: APIRoute = async ({ params, request }) => {
  const type = String(params.type ?? '');
  const slug = String(params.slug ?? '');
  const meta = getCollectionMeta(type);
  if (!meta) return new Response('not found', { status: 404 });
  const payload = (await request.json()) as { data: Record<string, any>; body?: string };
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
    message: `admin: update ${type}/${slug}`,
    content,
  });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const type = String(params.type ?? '');
  const slug = String(params.slug ?? '');
  const meta = getCollectionMeta(type);
  if (!meta) return new Response('not found', { status: 404 });
  const ext = meta.type === 'content' ? 'md' : 'json';
  const filePath = `${meta.contentDir}/${slug}.${ext}`;
  await deleteFile(filePath, `admin: delete ${type}/${slug}`);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
