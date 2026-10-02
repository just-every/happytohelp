import { LicenceDrawing } from './drawings/LicenceDrawing';
import { sourceUrl } from './repository';

const proof = ['No seats.', 'No plans.', 'No fees.'];

export function Free() {
  return <section className="section free" id="free" aria-labelledby="free-title">
    <div className="split">
      <div className="split-copy">
        <h2 id="free-title">Not just better. Free.</h2>
        <p>HappyToHelp is 100% free and open source. Free as in code, and free as in cost. It’s MIT licensed, so it’s yours to use, change and run however you like.</p>
        <div className="actions"><a className="pill pill--ink pill--large" href={sourceUrl}>Get the code</a></div>
      </div>
      <LicenceDrawing />
    </div>
    <ul className="proof">{proof.map(item => <li key={item}>{item}</li>)}</ul>
  </section>;
}
