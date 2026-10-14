import { HydrationUnit } from '../../vendor/base/hydration/unit';
import type { DocsNavPage } from './types';

/** Previous and next in manifest order, then the page's source on GitHub. */
export function DocsPager({ previous, next, editUrl }: { previous?: DocsNavPage; next?: DocsNavPage; editUrl: string }) {
  return <>
    <HydrationUnit><nav className="docs-pager" aria-label="Previous and next pages">
      {previous && <a className="docs-pager-card docs-pager-card--previous" rel="prev" href={previous.href}>
        <span className="docs-pager-label">Previous</span><span className="docs-pager-title">{previous.label}</span>
      </a>}
      {next && <a className="docs-pager-card docs-pager-card--next" rel="next" href={next.href}>
        <span className="docs-pager-label">Next</span><span className="docs-pager-title">{next.label}</span>
      </a>}
    </nav></HydrationUnit>
    <p className="docs-source"><a href={editUrl}>Edit this page on GitHub</a></p>
  </>;
}
