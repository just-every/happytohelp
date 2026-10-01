import { CompiledVisualEdits } from '../editor/EditorLauncher';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import NotFound from '../ui/homepage/NotFound'

const favicon = { rel: 'icon', type: 'image/png', href: '/homepage/media/brands/happytohelp-favicon.png' }

export const Route = createRootRoute({
  head: ({ matches }) => {
    // The 404 document is a public page in the homepage language: it needs its own title, robots hint and font preload.
    if (matches.some(match => match.status === 'notFound' || match._notFound)) return {
      meta: [{ title: 'Page not found · HappyToHelp' }, { charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }, { name: 'robots', content: 'noindex' }],
      links: [favicon, { rel: 'preload', href: '/fonts/outfit/outfit-latin-wght-normal.woff2', as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }],
    };
    return {
      meta: [{ title: 'HappyToHelp' }, { charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      title: 'HappyToHelp',
      links: [favicon],
    };
  },
  notFoundComponent: NotFound,
  component: () => <html lang="en"><head><HeadContent /></head><body><CompiledVisualEdits /><Outlet /><Scripts /></body></html>,
})
