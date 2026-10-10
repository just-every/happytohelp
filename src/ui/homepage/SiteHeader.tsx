import { BrandLockup } from './BrandLockup';
import { docsUrl, sourceUrl } from './repository';

/** `home` is where the brand links: the in-page anchor on the homepage, `/` on other public pages. `current` marks the docs. */
export function SiteHeader({ home = '#top', current }: { home?: string; current?: 'docs' }) {
  return <header className="site-header">
    <BrandLockup home={home} />
    <nav aria-label="Main navigation"><a href={docsUrl} aria-current={current === 'docs' ? 'true' : undefined}>Docs</a><a href={sourceUrl}>GitHub</a><a className="pill pill--ink" href={sourceUrl}>Get the code</a></nav>
  </header>;
}
