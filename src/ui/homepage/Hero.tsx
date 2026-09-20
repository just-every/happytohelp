import { HomepageBrand } from './HomepageBrand';
import { Headline } from './Headline';
import { JourneyMap } from './JourneyMap';
export function Hero() {
  return <div className="page" id="top">
    <JourneyMap section="hero" />
    <header><HomepageBrand /><nav aria-label="Main navigation"><a href="#features">FEATURES</a><a href="#open-source">ABOUT</a><a href="https://github.com/runeditrun/support-happytohelp">SOURCE</a></nav></header>
    <main><Headline /><div className="hero-details"><section className="intro" aria-label="Introduction">
      <p>What might software look like in 2 years? We tried to imagine it, then built it. AI customer support, MIT, 100% free.</p>
      <div className="actions"><a className="primary" href="#features"><span>Run</span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 10h15M11 4l6 6-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></a></div>
    </section>
    <img className="sculpture scene-corner" src="/homepage/media/graphics/rider-sculpted-toy.png" alt="Sculpted toy rider with raised spear beside a lantern" />
    </div></main>
  </div>;
}
