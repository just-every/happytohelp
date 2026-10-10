import { createFileRoute } from '@tanstack/react-router';
import { DocsPage } from '../ui/docs/DocsPage';
import { docsHead } from '../ui/docs/head';
import { loadDocsPage } from '../ui/docs/load';

// One documentation page, rendered at build time from the Markdown file docs/site.json lists for its slug.
export const Route = createFileRoute('/docs/$slug')({
  loader: ({ params }) => loadDocsPage(params.slug),
  head: ({ loaderData }) => docsHead(loaderData?.page),
  component: DocsArticlePage,
});

function DocsArticlePage() {
  return <DocsPage {...Route.useLoaderData()} />;
}
