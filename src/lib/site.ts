// Helpers for reading the editable `pages` content collection in templates.
// Each function returns a typed object with sensible fallbacks so a page can
// render even before its JSON file exists.

import { getEntry, type CollectionEntry } from 'astro:content';

type PageEntry = CollectionEntry<'pages'>['data'];

/** Site-wide config (nav, footer, brand). Always present in `src/content/pages/site.json`. */
export async function getSite(): Promise<PageEntry> {
  const entry = await getEntry('pages', 'site');
  return (
    entry?.data ?? {
      siteName: 'My Site',
      ownerName: 'Owner',
      tagline: '',
      email: '',
      location: '',
      description: '',
      socials: [],
      nav: [
        { href: '/', label: 'Home' },
        { href: '/about', label: 'About' },
      ],
      sections: [],
      sidebar: [],
    }
  );
}

/** Per-page copy. Pass the slug (e.g. 'home', 'about'). Returns null if missing. */
export async function getPage(slug: string): Promise<PageEntry | null> {
  const entry = await getEntry('pages', slug);
  return entry?.data ?? null;
}

/** Pull a section by eyebrow from a page's `sections` array. Case-insensitive. */
export function findSection(
  page: PageEntry | null,
  eyebrow: string
): PageEntry['sections'][number] | undefined {
  if (!page?.sections) return undefined;
  const needle = eyebrow.toLowerCase();
  return page.sections.find((s) => (s.eyebrow ?? '').toLowerCase() === needle);
}
