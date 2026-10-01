import { AgentDrawing } from './drawings/AgentDrawing';

export function AgentInvestigates() {
  return <section className="section agent" id="agent" aria-labelledby="agent-title">
    <div className="section-head">
      <h2 id="agent-title">Your own agent can investigate</h2>
      <p>Connect Codex or Claude on your own computer and choose its access and scope. It investigates the problem and leaves an internal note. Your team reviews the replies and keeps the context.</p>
    </div>
    <AgentDrawing />
  </section>;
}
