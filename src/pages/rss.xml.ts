import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getSite } from '@lib/site';

export async function GET(context: APIContext) {
  const site = await getSite();
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());

  return rss({
    title: `${site.siteName ?? 'Site'} — Writing`,
    description: site.description ?? '',
    site: context.site ?? 'https://example.com',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishedAt,
      description: post.data.description ?? '',
      link: `/writing/${post.slug}/`,
    })),
  });
}
