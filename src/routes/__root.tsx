import { CompiledVisualEdits } from '../editor/EditorLauncher';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: 'HappyToHelp' }, { charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    title: 'HappyToHelp',
    links: [{ rel: 'icon', type: 'image/png', href: '/homepage/media/brands/happytohelp-favicon.png' }],
  }),
  notFoundComponent: () => <h1>Not found</h1>,
  component: () => <html lang="en"><head><HeadContent /></head><body><CompiledVisualEdits /><Outlet /><Scripts /></body></html>,
})
