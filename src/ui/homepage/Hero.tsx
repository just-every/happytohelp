import { Headline } from './Headline';
import { JourneyMap } from './JourneyMap';
export function Hero() {
  return <div className="page" id="top">
    <JourneyMap section="hero" />
    <header><a className="brand" href="#top" aria-label="HappyToHelp home"><span>HappyToHelp</span></a><nav aria-label="Main navigation"><a href="#features">FEATURES</a><a href="#open-source">ABOUT</a><a href="https://github.com/runeditrun/support-happytohelp">SOURCE</a></nav></header>
    <main><Headline /><section className="intro" aria-label="Introduction">
      <div className="hero-chapter" aria-hidden="true">01</div>
      <h2>AI customer support that puts your knowledge to work.</h2>
      <p>Bring customer conversations, knowledge and AI assistance into one workspace, with your team ready to step in.</p>
      <p>Connect your content, keep answers grounded in what you know, and give your team the context to help when a conversation needs a human.</p>
      <div className="actions"><a className="primary" href="#features"><span>Explore features</span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 10h15M11 4l6 6-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></a><a href="https://github.com/runeditrun/support-happytohelp"><span>Read the source</span></a></div>
    </section></main>
    <img className="sculpture scene-corner" src="/homepage/media/graphics/rider-sculpted-toy.png" alt="Sculpted toy rider with raised spear beside a lantern" />
  </div>;
}
