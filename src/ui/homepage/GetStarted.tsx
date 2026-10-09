import { docsUrl, sourceUrl } from './repository';

export function GetStarted() {
  return <section className="section get-started" id="get-started" aria-labelledby="get-started-title">
    <h2 id="get-started-title">Ready when you are.</h2>
    <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={docsUrl}>Read the docs</a></div>
  </section>;
}
