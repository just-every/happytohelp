import { BillDrawing } from './drawings/BillDrawing';
import { costsUrl, sourceUrl } from './repository';

const proof = ['Seats: none.', 'Fee per resolution: none.', 'Licence: MIT.'];

export function Free() {
  return <section className="section free" id="free" aria-labelledby="free-title">
    <div className="split">
      <div className="split-copy">
        <h2 id="free-title">Not just better. Free.</h2>
        <p>HappyToHelp is open source under the MIT licence. There are no seats to buy, no plan to outgrow and no fee for each conversation it resolves, so adding your whole team costs nothing extra. It runs in your own Cloudflare account, where hosting starts at about US$5 a month. The agent is the Codex or Claude your team already uses, and AI is paid to your provider at their price, with nothing added by us.</p>
        <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a><a className="text-link" href={costsUrl}>See what you need to run it</a></div>
      </div>
      <BillDrawing />
    </div>
    <ul className="proof" aria-label="What you pay HappyToHelp">{proof.map(item => <li key={item}>{item}</li>)}</ul>
  </section>;
}
