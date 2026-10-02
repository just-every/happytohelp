import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

const free = ['Software', 'Team seats', 'Resolved conversations'];
const paid = [['Hosting', 'Your Cloudflare account'], ['AI', 'Your provider, at their price']];

// A bill in the drawing language (a note card, not a product screen): what is free, what is paid elsewhere, and what is paid to HappyToHelp.
export function BillDrawing() {
  return <Drawing className="bill-art" label="Drawing of a bill: software, team seats and resolved conversations are free; hosting is your own Cloudflare account and AI is paid to your provider at their price. Paid to HappyToHelp: $0.">
    <SketchMarks variant="sparkle" />
    <div className="d-window yours-card">
      <b className="bill-title">Your HappyToHelp bill</b>
      <ul className="bill-rows">
        {free.map(label => <li key={label}><span className="d-check"><Icon name="check" /></span><span className="bill-label">{label}</span><i className="bill-dots" /><span className="bill-value">Free</span></li>)}
        <li className="bill-rule" />
        {paid.map(([label, value]) => <li key={label}><span className="bill-label">{label}</span><i className="bill-dots" /><span className="bill-value">{value}</span></li>)}
      </ul>
      <p className="bill-total"><span>Paid to HappyToHelp:</span><span className="bill-zero">$0<svg viewBox="0 0 60 8" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false"><path vectorEffect="non-scaling-stroke" d="M2 5c12-3 30-4 56-2" /></svg></span></p>
    </div>
  </Drawing>;
}
