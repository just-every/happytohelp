import { docsUrl, licenseUrl, sourceUrl } from './repository';

export function SiteFooter() {
  return <footer className="site-footer">
    <a className="brand" href="#top">HappyToHelp</a>
    <nav aria-label="Footer navigation">
      <a href={docsUrl}>Docs</a><a href={sourceUrl}>GitHub</a>
      <a href="/projects">Workspace</a><a href="/setup">Set up</a><a href="/login">Log in</a>
      <a className="pill pill--outline" href={licenseUrl}>MIT licence</a>
    </nav>
  </footer>;
}
