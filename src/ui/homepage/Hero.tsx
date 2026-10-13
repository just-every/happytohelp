import { HydrationUnit } from '../../vendor/base/hydration/unit';
import { Flourish } from './drawings/Flourish';
import { HeroHandoff } from './drawings/HeroHandoff';
import { docsUrl, sourceUrl } from './repository';

const steps = ['The customer asks', 'The agent fixes it', 'You press Send'];

export function Hero() {
  return <HydrationUnit><section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-copy">
      <h1 id="hero-title"><span>Customer Support,</span> <span>Solved.</span></h1>
      <p className="hero-sub">Your Codex or Claude fixes the problem and writes the reply. You press Send.</p>
      <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={docsUrl}>Read the docs</a></div>
      <p className="hero-free">100% free, open source alternative to <strong>Zendesk</strong>, <strong>Intercom</strong>, <strong>Help&nbsp;Scout</strong> and <strong>Freshdesk</strong></p>
      <Flourish intro />
    </div>
    <div className="hero-stage">
      <HeroHandoff />
      <ol className="hero-steps">{steps.map(step => <li key={step}>{step}</li>)}</ol>
    </div>
  </section></HydrationUnit>;
}
