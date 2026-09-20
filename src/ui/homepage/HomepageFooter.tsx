import { HomepageBrand } from './HomepageBrand';
export function HomepageFooter() {
  return (
    <footer className="home-footer">
      <HomepageBrand />
      <nav aria-label="Footer navigation">
        <a href="#features">Features</a>
        <a href="https://github.com/runeditrun/support-happytohelp/blob/main/README.md">Documentation</a>
        <a href="https://github.com/runeditrun/support-happytohelp">Source ↗</a>
        <a href="/projects">Workspace</a>
        <a href="/setup">Set up</a>
        <a href="/login">Log in</a>
      </nav>
    </footer>
  );
}
