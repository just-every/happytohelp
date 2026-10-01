import { Icon } from './Icons';
import { Drawing, SketchMarks } from './Sketch';

const actions = ['Investigate', 'Resolve', 'Resolve & reply'];

// The "New task" form of the Local panel with its Action menu open, and a follow-up action offered by an earlier result.
export function TaskFormDrawing() {
  return <Drawing className="task-art" label="Drawing of the New task form in the Local panel. The Worker is Codex on Mina's Mac and is ready. The Action menu lists Investigate, Resolve and Resolve & reply, with a note that a customer reply is sent only after the worker reports verified work. Below it, a follow-up action from an earlier result can be run.">
    <SketchMarks variant="sparkle" />
    <div className="d-window task-form">
      <div className="tf-head"><span className="tf-icon"><Icon name="send" /></span><span><b>New task</b><small>Choose the outcome, then give the worker a focused instruction.</small></span></div>
      <div className="tf-field"><span>Worker</span><span className="tf-select">Mina’s support Mac · Codex (ready)</span></div>
      <p className="tf-ready"><Icon name="check" />Worker is ready to receive this task.</p>
      <div className="tf-field"><span>Action</span>
        <ul className="tf-menu">{actions.map(a => <li key={a} className={a === 'Resolve & reply' ? 'is-selected' : undefined}>{a}{a === 'Resolve & reply' && <Icon name="check" />}</li>)}</ul>
      </div>
      <div className="tf-field"><span>Instructions</span><span className="tf-text">Move Maya’s billing date to the 15th and tell her once it is done.<small>66 / 12,000</small></span></div>
      <p className="tf-notice"><Icon name="shield" />A customer reply is sent only after the worker reports verified work.</p>
      <span className="d-btn d-btn--ink tf-send"><Icon name="send" />Send task</span>
      <b className="tf-follow"><Icon name="play" />Follow-up actions</b>
      <div className="tf-option"><span><b>Apply the new billing date</b>Move Maya’s billing date to the 15th once the September invoice is paid.<small>Resolve</small></span><span className="d-btn">Run</span></div>
    </div>
  </Drawing>;
}
