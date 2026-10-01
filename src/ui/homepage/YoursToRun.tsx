import { YoursDrawing } from './drawings/YoursDrawing';
import { installerUrl, sourceUrl } from './repository';

export function YoursToRun() {
  return <section className="section split split--reverse" id="yours-to-run" aria-labelledby="yours-title">
    <div className="split-copy">
      <h2 id="yours-title">Yours to run</h2>
      <p>HappyToHelp is free and MIT licensed. It runs in your own Cloudflare account, and you keep the code and the data. Hosting and AI usage are paid to the providers you choose.</p>
      <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={installerUrl}>Read the installation guide</a></div>
    </div>
    <YoursDrawing />
  </section>;
}
