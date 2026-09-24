import { docsUrl, installerUrl, sourceUrl } from './VillageHero';
import { VillageScene } from './VillageScene';

export function VillageWorkshops() {
  return <>
    <section className="agents" id="agents" aria-labelledby="agents-title">
      <VillageScene name="agents" width={3072} height={2048} alt="Two cloaked agents exchange a document across a wooden counter in a lantern-lit village library." />
      <div className="inner workshop-copy"><h2 id="agents-title">Your agents, working together.</h2><p className="intro">Connect Codex or Claude on your computer. Choose access and scope, review replies, and keep the context when your team steps in.</p><p className="intro">Use configured AI providers for suggestions, or delegate an investigation to your local CLI agent with explicit access. Your team can take over the conversation.</p><a className="text-link" href={installerUrl}>Read the installation guide <span aria-hidden="true">→</span></a></div>
    </section>
    <section className="license" id="open-source" aria-labelledby="license-title">
      <VillageScene name="license" width={3072} height={1724} alt="Two craftspeople collaborate over plans in a timber workshop with stone walls and blue banners." />
      <div className="inner workshop-copy"><h2 id="license-title"><span>100% free.</span> <span>MIT licensed.</span></h2><p className="intro">Run it. Change it. Make it yours.<br />Keep the code and run it in accounts you control. Hosting and AI usage are paid through the providers you choose.</p><div className="actions"><a href={sourceUrl}><span className="badge" aria-hidden="true"><svg><use href="#village-code" /></svg></span><span>Get code</span><span aria-hidden="true">→</span></a><a href={docsUrl}><span className="badge" aria-hidden="true"><svg><use href="#village-book" /></svg></span><span>Read docs</span><span aria-hidden="true">→</span></a></div></div>
    </section>
  </>;
}

export function VillageFooter() {
  return <footer className="village-footer"><a className="brand" href="#top">HappyToHelp</a><nav aria-label="Footer navigation"><a href="#features">Features</a><a href={docsUrl}>Docs</a><a href={sourceUrl}>GitHub</a><a href="/projects">Workspace</a><a href="/setup">Set up</a><a href="/login">Log in</a></nav><span className="footer-note">Open source. Better support.</span></footer>;
}
