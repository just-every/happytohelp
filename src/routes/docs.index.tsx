import { createFileRoute } from '@tanstack/react-router';
import { DocsPage } from '../ui/docs/DocsPage';
import { docsHead } from '../ui/docs/head';
import { loadDocsPage } from '../ui/docs/load';

// The docs home: README.md, rendered at build time (docs/site.json lists every page).
export const Route = createFileRoute('/docs/')({
  loader: () => loadDocsPage(''),
  head: ({ loaderData }) => docsHead(loaderData?.page),
  component: DocsHome,
});

function DocsHome() {
  return <DocsPage {...Route.useLoaderData()} />;
}
