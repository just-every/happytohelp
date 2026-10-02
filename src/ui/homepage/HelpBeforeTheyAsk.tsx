import { OfferDrawing } from './drawings/OfferDrawing';

const signals = ['Lingering on a page', 'Sitting idle', 'Scrolling back up', 'Pausing at checkout'];

export function HelpBeforeTheyAsk() {
  return <section className="section split" id="help-before-they-ask" aria-labelledby="offer-title">
    <div className="split-copy">
      <h2 id="offer-title">Help before they ask</h2>
      <p>Some customers who get stuck never write in. They just leave. When a visitor seems stuck, the widget offers a hand once, if they have agreed to it. Say no and it stays quiet. A person can always take over.</p>
      <ul className="signals" aria-label="Signals that a visitor may be stuck">{signals.map(s => <li key={s}>{s}</li>)}</ul>
    </div>
    <OfferDrawing />
  </section>;
}
