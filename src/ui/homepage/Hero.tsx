import { HeroInbox } from './drawings/HeroInbox';
import { docsUrl, sourceUrl } from './repository';

export function Hero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-copy">
      <h1 id="hero-title"><span>Customer Support,</span> <span>Solved.</span></h1>
      <p>Free and open source: chat widget, shared inbox, help centre and AI-suggested replies with sources.</p>
      <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={docsUrl}>Read the docs</a></div>
    </div>
    <HeroInbox />
  </section>;
}
