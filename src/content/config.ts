import { defineCollection, z } from 'astro:content';

const photos = defineCollection({
  type: 'data',
  schema: ({ image }) =>
    z.object({
      title: z.string().optional(),
      caption: z.string().optional(),
      image: image(),
      location: z.string().optional(),
      takenAt: z.coerce.date().optional(),
      featured: z.boolean().default(false),
      // Optional weight to influence grid sizing (1 = normal, 2 = wide, etc.)
      span: z.number().min(1).max(3).default(1),
      // Tags shown as a small overlay on each card and used for the gallery filter
      tags: z.array(z.string()).default([]),
    }),
});

const art = defineCollection({
  type: 'data',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      caption: z.string().optional(),
      image: image(),
      medium: z.string().optional(),
      createdAt: z.coerce.date().optional(),
      featured: z.boolean().default(false),
    }),
});

const posts = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      cover: image().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

const playlists = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    blurb: z.string().optional(),
    mood: z.string().optional(),
    // Spotify or Apple Music embed URL, or playlist link
    embedUrl: z.string().url().optional(),
    link: z.string().url().optional(),
    color: z.string().optional(),
    createdAt: z.coerce.date().optional(),
  }),
});

const apps = defineCollection({
  type: 'data',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      tagline: z.string(),
      description: z.string().optional(),
      url: z.string().url().optional(),
      repoUrl: z.string().url().optional(),
      cover: image().optional(),
      status: z.enum(['live', 'beta', 'wip', 'archived']).default('live'),
      year: z.number().optional(),
    }),
});

// Editable site & page copy. Each entry is a JSON file under src/content/pages/.
// `site.json` is the only required one — it powers nav, footer, brand, etc.
// Page-specific entries (home.json, about.json) hold per-page copy.
const pages = defineCollection({
  type: 'data',
  schema: z.object({
    // Site-wide (only meaningful on site.json, but kept optional so per-page
    // files don't need it)
    siteName: z.string().optional(),
    ownerName: z.string().optional(),
    tagline: z.string().optional(),
    email: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    socials: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        })
      )
      .default([]),
    nav: z
      .array(
        z.object({
          href: z.string(),
          label: z.string(),
        })
      )
      .optional(),

    // Per-page fields (used by individual pages — all optional so the schema
    // works for every page entry)
    eyebrow: z.string().optional(),
    heading: z.string().optional(),
    subheading: z.string().optional(),
    body: z.string().optional(),
    cta: z
      .object({
        label: z.string().optional(),
        href: z.string().optional(),
      })
      .optional(),

    // Generic structured content — sections, lists, sidebar rows, etc.
    sections: z
      .array(
        z.object({
          eyebrow: z.string().optional(),
          heading: z.string().optional(),
          body: z.string().optional(),
          items: z.array(z.string()).default([]),
        })
      )
      .default([]),

    // For about-style "sidebar cards" with label/value rows
    sidebar: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        })
      )
      .default([]),
  }),
});

export const collections = { photos, art, posts, playlists, apps, pages };
