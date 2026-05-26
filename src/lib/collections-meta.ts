// Metadata describing every content collection: what fields exist, how to
// render them in the admin form, and where their files live on disk.
//
// Adding a new collection: edit `src/content/config.ts` to register its Zod
// schema, then add an entry here so the admin can render an editor for it.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'image'
  | 'tags'
  | 'links' // array of { label, url }
  | 'sections' // array of { eyebrow, heading, body, items[] }
  | 'sidebar' // array of { label, value }
  | 'cta'; // single { label, href }

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  required?: boolean;
  options?: string[]; // for select
  rows?: number;
  /**
   * For the `pages` collection only: which slugs this field applies to.
   * 'site' = only show on site.json; 'page' = only show on per-page entries.
   * Omit to show on all.
   */
  scope?: 'site' | 'page';
}

export interface CollectionMeta {
  /** URL slug used in admin routes */
  slug: string;
  /** Display name */
  label: string;
  /** Pluralized noun for buttons */
  itemNoun: string;
  /** Path under src/content/ */
  contentDir: string;
  /** Where uploaded images live, relative to project root */
  assetsDir: string;
  /** 'data' = JSON entries; 'content' = markdown entries */
  type: 'data' | 'content';
  /** Optional sort key (newest first) — must be a date field */
  sortBy?: string;
  fields: FieldDef[];
  /** For 'content' collections, the markdown body field */
  bodyLabel?: string;
}

export const COLLECTIONS: CollectionMeta[] = [
  {
    slug: 'photos',
    label: 'Photos',
    itemNoun: 'photo',
    contentDir: 'src/content/photos',
    assetsDir: 'src/content/photos/assets',
    type: 'data',
    sortBy: 'takenAt',
    fields: [
      { name: 'image', label: 'Photo', type: 'image', required: true },
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'caption', label: 'Caption', type: 'textarea', rows: 2 },
      { name: 'location', label: 'Location', type: 'text', help: 'City, ST' },
      { name: 'takenAt', label: 'Taken on', type: 'date' },
      { name: 'tags', label: 'Tags', type: 'tags', help: 'Comma-separated' },
      {
        name: 'span',
        label: 'Grid span',
        type: 'select',
        options: ['1', '2', '3'],
        help: '1 = normal, 2 = wide, 3 = extra wide',
      },
      { name: 'featured', label: 'Featured', type: 'boolean' },
    ],
  },
  {
    slug: 'art',
    label: 'Art',
    itemNoun: 'piece',
    contentDir: 'src/content/art',
    assetsDir: 'src/content/art/assets',
    type: 'data',
    sortBy: 'createdAt',
    fields: [
      { name: 'image', label: 'Image', type: 'image', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'caption', label: 'Caption', type: 'textarea', rows: 2 },
      { name: 'medium', label: 'Medium', type: 'text', help: 'Ink on paper · Procreate · etc.' },
      { name: 'createdAt', label: 'Created on', type: 'date' },
      { name: 'featured', label: 'Featured', type: 'boolean' },
    ],
  },
  {
    slug: 'posts',
    label: 'Writing',
    itemNoun: 'post',
    contentDir: 'src/content/posts',
    assetsDir: 'src/content/posts/assets',
    type: 'content',
    sortBy: 'publishedAt',
    bodyLabel: 'Post body (Markdown)',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', rows: 2, help: 'Shows on the index and in social previews' },
      { name: 'publishedAt', label: 'Published', type: 'date', required: true },
      { name: 'updatedAt', label: 'Updated', type: 'date' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      { name: 'cover', label: 'Cover image', type: 'image' },
      { name: 'draft', label: 'Draft', type: 'boolean', help: 'Hidden from the site' },
    ],
  },
  {
    slug: 'playlists',
    label: 'Playlists',
    itemNoun: 'playlist',
    contentDir: 'src/content/playlists',
    assetsDir: 'src/content/playlists',
    type: 'data',
    sortBy: 'createdAt',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'blurb', label: 'Blurb', type: 'textarea', rows: 2 },
      { name: 'mood', label: 'Mood', type: 'text', help: 'drive · 2am · rainy' },
      { name: 'color', label: 'Color', type: 'text', help: 'Hex like #4d3dff' },
      { name: 'link', label: 'Link', type: 'text' },
      { name: 'embedUrl', label: 'Embed URL', type: 'text', help: 'Spotify/Apple embed URL' },
      { name: 'createdAt', label: 'Created on', type: 'date' },
    ],
  },
  {
    slug: 'apps',
    label: 'Apps',
    itemNoun: 'app',
    contentDir: 'src/content/apps',
    assetsDir: 'src/content/apps/assets',
    type: 'data',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'tagline', label: 'Tagline', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
      { name: 'url', label: 'URL', type: 'text' },
      { name: 'repoUrl', label: 'Repo URL', type: 'text' },
      { name: 'cover', label: 'Cover image', type: 'image' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['live', 'beta', 'wip', 'archived'],
      },
      { name: 'year', label: 'Year', type: 'number' },
    ],
  },
  {
    slug: 'pages',
    label: 'Pages & Site',
    itemNoun: 'page',
    contentDir: 'src/content/pages',
    assetsDir: 'src/content/pages',
    type: 'data',
    fields: [
      { name: 'siteName', label: 'Site name', type: 'text', scope: 'site' },
      { name: 'ownerName', label: 'Owner name', type: 'text', scope: 'site' },
      { name: 'tagline', label: 'Tagline', type: 'text', scope: 'site' },
      { name: 'email', label: 'Email', type: 'text', scope: 'site' },
      { name: 'location', label: 'Location', type: 'text', scope: 'site' },
      { name: 'description', label: 'Site description (SEO)', type: 'textarea', rows: 2, scope: 'site' },
      { name: 'socials', label: 'Social links', type: 'links', scope: 'site' },
      { name: 'nav', label: 'Nav menu', type: 'links', scope: 'site' },
      { name: 'eyebrow', label: 'Page eyebrow', type: 'text', scope: 'page' },
      { name: 'heading', label: 'Page heading', type: 'text', help: 'HTML allowed (e.g. <em>)', scope: 'page' },
      { name: 'subheading', label: 'Subheading', type: 'textarea', rows: 2, scope: 'page' },
      { name: 'body', label: 'Body', type: 'textarea', rows: 8, help: 'Use blank lines for paragraphs', scope: 'page' },
      { name: 'cta', label: 'CTA button', type: 'cta', scope: 'page' },
      { name: 'sidebar', label: 'Sidebar (label/value rows)', type: 'sidebar', scope: 'page' },
      { name: 'sections', label: 'Sections', type: 'sections', scope: 'page' },
    ],
  },
];

export function getCollectionMeta(slug: string): CollectionMeta | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}
