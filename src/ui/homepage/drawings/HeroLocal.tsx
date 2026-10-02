import { Icon } from './Icons';

// The conversation's right-hand panel on the Local tab (DelegationPanel) once a Resolve task has completed: the job
// card with its screenshot, the suggested reply (already used) and the collapsed evidence row.
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
        <span>
          <b>Resolve completed</b>Spanish was stuck in Draft. It is now live on Maya’s store.
          <span className="hl-shot"><b>Hola</b><i className="sk-line w70" /><i className="sk-line w50" /></span>
        </span>
      </div>
      <b className="hl-heading"><Icon name="chat" />Suggested replies</b>
      <div className="hl-reply">
        <Icon name="chat" />
        <span><b>Spanish is live</b><i className="sk-line w90" /><i className="sk-line w60" /></span>
        <span className="d-btn">Use</span>
      </div>
      <div className="hl-evidence"><span><Icon name="chevron" />Evidence and details</span><em className="d-chip"><Icon name="check" />Verified</em></div>
    </div>
  </div>;
}
