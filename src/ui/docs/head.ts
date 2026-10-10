import type { DocsPageData } from './types';

/** Title, description and font preload for a docs page. Without a page (a 404) the root's not-found head applies. */
export function docsHead(page: DocsPageData | undefined) {
  if (!page) return {};
  return {
    meta: [
      { title: page.slug ? `${page.title} · HappyToHelp docs` : 'HappyToHelp docs' },
      { name: 'description', content: page.description },
    ],
    links: [{ rel: 'preload', href: '/fonts/outfit/outfit-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' as const }],
  };
}
