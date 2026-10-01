import { HeroHandoff } from './drawings/HeroHandoff';
import { docsUrl, sourceUrl } from './repository';

export function Hero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-copy">
      <h1 id="hero-title"><span>Customer Support,</span> <span>Solved.</span></h1>
      <p>Free and open source. Hand a conversation to Codex or Claude on your own computer. It investigates, leaves an internal note and drafts a reply. You choose what it may do for each task, and your team reviews the draft and decides what is sent.</p>
      <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={docsUrl}>Read the docs</a></div>
    </div>
    <HeroHandoff />
  </section>;
}
