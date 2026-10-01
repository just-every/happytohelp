import { docsUrl, sourceUrl } from './repository';

/** `home` is where the brand links: the in-page anchor on the homepage, `/` on other public pages. */
export function SiteHeader({ home = '#top' }: { home?: string }) {
  return <header className="site-header">
    <a className="brand" href={home}>HappyToHelp</a>
    <nav aria-label="Main navigation"><a href={docsUrl}>Docs</a><a href={sourceUrl}>GitHub</a><a className="pill pill--ink" href={sourceUrl}>Get the code</a></nav>
  </header>;
}
