// Filesystem reads for the admin (run at request time on the server).
// Writes go through src/lib/github.ts so they trigger a Vercel rebuild.

import fs from 'node:fs/promises';
import path from 'node:path';
import { getCollectionMeta } from './collections-meta';

export interface ItemRow {
  slug: string;
  data: Record<string, any>;
  /** Markdown body for content collections */
  body?: string;
  /** Repo-relative path */
  filePath: string;
}

function projectRoot(): string {
  return process.cwd();
}

function listDir(dir: string): Promise<string[]> {
  return fs.readdir(dir).catch(() => []);
}

/** Split a markdown file into frontmatter + body. */
function parseMarkdown(src: string): { data: Record<string, any>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const yaml = m[1];
  const body = m[2] ?? '';
  // Minimal YAML parser — we only support what our schemas use.
  const data: Record<string, any> = {};
  let i = 0;
  const lines = yaml.split('\n');
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    let rest = kv[2].trim();
    if (rest === '' || rest === '[]') {
      // Could be a block list on next lines
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, ''));
        j++;
      }
      if (items.length > 0) { data[key] = items; i = j; continue; }
      data[key] = rest === '[]' ? [] : '';
      i++;
      continue;
    }
    // Inline arrays like: tags: [a, b]
    if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      data[key] = inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else if (rest === 'true' || rest === 'false') {
      data[key] = rest === 'true';
    } else if (/^-?\d+(\.\d+)?$/.test(rest)) {
      data[key] = Number(rest);
    } else {
      data[key] = rest.replace(/^["']|["']$/g, '');
    }
    i++;
  }
  return { data, body };
}

/** Serialize frontmatter + body back to a markdown file. */
export function serializeMarkdown(data: Record<string, any>, body: string): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      // Use inline array for simple string arrays (like tags)
      if (v.every((x) => typeof x === 'string' && !x.includes(','))) {
        lines.push(`${k}: [${v.join(', ')}]`);
      } else {
        lines.push(`${k}:`);
        v.forEach((x) => lines.push(`  - ${JSON.stringify(x)}`));
      }
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      lines.push(`${k}: ${v}`);
    } else {
      const s = String(v);
      if (/[:#\n"']/.test(s)) lines.push(`${k}: ${JSON.stringify(s)}`);
      else lines.push(`${k}: ${s}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n\n' + body.trimStart();
}

/** List every entry in a collection by reading the filesystem. */
export async function listItems(collectionSlug: string): Promise<ItemRow[]> {
  const meta = getCollectionMeta(collectionSlug);
  if (!meta) return [];
  const abs = path.resolve(projectRoot(), meta.contentDir);
  const entries = await listDir(abs);
  const out: ItemRow[] = [];
  for (const f of entries) {
    // Skip template files, hidden files, and asset directories
    if (f.startsWith('_') || f.startsWith('.') || f === 'assets') continue;
    const full = path.join(abs, f);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) continue;
    if (meta.type === 'data' && f.endsWith('.json')) {
      try {
        const raw = await fs.readFile(full, 'utf8');
        const data = JSON.parse(raw);
        out.push({
          slug: f.replace(/\.json$/, ''),
          data,
          filePath: `${meta.contentDir}/${f}`,
        });
      } catch {
        // skip malformed
      }
    } else if (meta.type === 'content' && (f.endsWith('.md') || f.endsWith('.mdx'))) {
      try {
        const raw = await fs.readFile(full, 'utf8');
        const { data, body } = parseMarkdown(raw);
        out.push({
          slug: f.replace(/\.(md|mdx)$/, ''),
          data,
          body,
          filePath: `${meta.contentDir}/${f}`,
        });
      } catch {
        // skip
      }
    }
  }
  if (meta.sortBy) {
    out.sort((a, b) => {
      const av = a.data[meta.sortBy!];
      const bv = b.data[meta.sortBy!];
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return String(bv).localeCompare(String(av));
    });
  }
  return out;
}

export async function getItem(collectionSlug: string, slug: string): Promise<ItemRow | null> {
  const items = await listItems(collectionSlug);
  return items.find((i) => i.slug === slug) ?? null;
}

/** Slugify a free-text title. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || `item-${Date.now()}`;
}
