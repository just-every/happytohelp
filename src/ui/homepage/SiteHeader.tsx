import { docsUrl, sourceUrl } from './repository';

export function SiteHeader() {
  return <header className="site-header">
    <a className="brand" href="#top">HappyToHelp</a>
    <nav aria-label="Main navigation"><a href={docsUrl}>Docs</a><a href={sourceUrl}>GitHub</a><a className="pill pill--ink" href={sourceUrl}>Get the code</a></nav>
  </header>;
}
