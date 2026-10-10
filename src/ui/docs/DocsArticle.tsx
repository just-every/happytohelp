import { DocsTitleStroke } from './DocsTitleStroke';
import { DocsTocCompact } from './DocsToc';
import type { TitleStroke } from './title-strokes';
import type { DocsPageData } from './types';

/** The page's title with its own pen stroke under it, and its body, rendered from Markdown at build time. */
export function DocsArticle({ page, section, stroke }: { page: DocsPageData; section: string; stroke: TitleStroke }) {
  return <>
    <header className="docs-page-head">
      <p className="docs-eyebrow">{section}</p>
      <div className="docs-title-line">
        <h1 id={page.titleId} className="docs-title">{page.title}</h1>
        <DocsTitleStroke stroke={stroke} />
      </div>
    </header>
    <DocsTocCompact toc={page.toc} />
    <div className="docs-prose" dangerouslySetInnerHTML={{ __html: page.html }} />
  </>;
}
