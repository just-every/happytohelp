import { Icon } from './Icons';

// The conversation's right-hand panel on the Local tab (DelegationPanel) after an Investigate task has completed.
export function HeroLocal() {
  return <div className="hero-local">
    <ul className="hl-tabs"><li>AI</li><li className="is-active">Local</li><li>Details</li></ul>
    <div className="hl-body">
      <b className="hl-title">Work with your local agent</b>
      <p className="hl-intro">Delegate this conversation to Codex or Claude on your computer.</p>
      <div className="hl-connection">
        <Icon name="monitor" />
        <span><b><Icon name="check" />Ready</b>Codex on Mina’s Mac is ready for new work.<small>Workspace connection · 0 / 1 active tasks</small></span>
      </div>
      <div className="hl-job">
        <Icon name="check" />
        <span><b>Investigate completed</b>The billing date can be moved to the 15th. An unpaid September invoice blocked the change.</span>
      </div>
      <b className="hl-heading"><Icon name="chat" />Suggested replies</b>
      <div className="hl-reply">
        <b>Explain the change</b>
        <p>Hi Maya, you can move your billing date to the 15th from Settings &gt; Billing. It will apply from your next cycle.</p>
        <span className="d-btn d-btn--ink">Use</span>
      </div>
      <div className="hl-evidence"><span>Evidence and details</span><em className="d-chip"><Icon name="check" />Verified</em></div>
    </div>
  </div>;
}
