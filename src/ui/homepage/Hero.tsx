import { HeroHandoff } from './drawings/HeroHandoff';
import { docsUrl, sourceUrl } from './repository';

const examples = ['“I never got the invite.”', '“My export is stuck.”', '“I can’t turn on dark mode.”'];
const steps = ['The customer asks', 'The agent fixes it', 'You press Send'];

export function Hero() {
  return <section className="hero" id="top" aria-labelledby="hero-title">
    <div className="hero-copy">
      <h1 id="hero-title"><span>Customer Support,</span> <span>Solved.</span></h1>
      <p className="hero-sub">Hand the conversation to Codex or Claude on your own computer. It finds the cause, fixes it with the tools you already use, confirms it works and writes the reply. You check it and press Send.</p>
      <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={docsUrl}>Read the docs</a></div>
      <p className="hero-free">Free and open source.</p>
      <p className="hero-examples"><b>The same move for:</b> {examples.map((example, index) => <span key={example}>{index > 0 && <i aria-hidden="true"> · </i>}{example}</span>)}</p>
    </div>
    <div className="hero-stage">
      <HeroHandoff />
      <ol className="hero-steps">{steps.map(step => <li key={step}>{step}</li>)}</ol>
    </div>
  </section>;
}
