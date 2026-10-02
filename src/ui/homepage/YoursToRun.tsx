import { InstallerDrawing } from './drawings/InstallerDrawing';
import { hostedUrl, installerUrl, sourceUrl } from './repository';

export function YoursToRun() {
  return <section className="section split" id="yours-to-run" aria-labelledby="yours-title">
    <div className="split-copy">
      <h2 id="yours-title">Yours to run</h2>
      <p>Your Cloudflare account, your code, your data. Conversations and files live in your own account, and the code is yours to read, fork and change. No vendor sits between you and your customers, and there is no price to be raised.</p>
      <p>Rather not host it yourself? Hosted options are available through <a className="inline-link" href={hostedUrl}>Run Edit Run</a>.</p>
      <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={installerUrl}>Read the installation guide</a></div>
    </div>
    <InstallerDrawing />
  </section>;
}
