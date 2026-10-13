import { HydrationUnit } from '../../vendor/base/hydration/unit';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './outfit.css';
import './brand-tokens.css';
import './homepage.css';
import './not-found.css';

/** Branded 404 for any path the application does not serve; the HTTP status stays 404. */
export default function NotFound() {
  return <div className="h2h-home">
    <a className="skip-link" href="#not-found">Skip to the message</a>
    <SiteHeader home="/" />
    <main>
      <HydrationUnit><section className="not-found" id="not-found" aria-labelledby="not-found-title">
        <p className="not-found-code" aria-hidden="true">404</p>
        <h1 id="not-found-title">Page not found.</h1>
        <p className="not-found-copy">We can’t find the page you asked for. The address may be mistyped, or it may have moved or been taken down. Head back to the homepage, or carry on in your workspace.</p>
        <div className="actions"><a className="pill pill--ink pill--large" href="/">Back to the homepage</a><a className="text-link" href="/projects">Open your workspace</a></div>
      </section></HydrationUnit>
    </main>
    <SiteFooter home="/" />
  </div>;
}
