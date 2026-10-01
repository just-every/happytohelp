import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

// A terminal on the team's own computer beside the internal note the agent leaves.
export function AgentDrawing() {
  return <Drawing className="agent-art" label="Drawing of a terminal beside an internal note. In the terminal, a local agent with read-only access reads billing logs and docs and writes a note. The internal note records what it found and says the drafted reply is waiting for the team to review.">
    <SketchMarks variant="spark" />
    <div className="agent-panels">
      <div className="d-window agent-terminal">
        <div className="d-bar"><i /><i /><i /><span className="agent-title">your computer</span></div>
        <pre>
          <span className="t-dim">$ claude</span>{'\n'}
          <span className="t-ok">access</span> read-only{'\n'}
          <span className="t-ok">scope</span> billing repo + help centre{'\n'}
          {'\n'}
          <span className="t-dim">› reading billing-2026-09-30.log</span>{'\n'}
          <span className="t-dim">› reading docs/billing-dates.md</span>{'\n'}
          <span className="t-ok">✓</span> internal note saved
        </pre>
      </div>
      <svg className="agent-arrow" viewBox="0 0 40 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M2 9c10-5 20-5 34-1M30 3l6 5-6 5" /></svg>
      <div className="d-window agent-note">
        <div className="agent-note-head"><Icon name="lock" />Internal note<em className="d-tag">Team only</em></div>
        <p>Changing the billing date to the 31st fails in months with 30 days. Found in the billing log. Fix and customer reply drafted below.</p>
        <p className="agent-note-foot">Reply drafted · waiting for your review</p>
      </div>
    </div>
  </Drawing>;
}
