import { JourneyMap } from "./JourneyMap";

export function AgentsSection() {
  return (
    <section className="home-section light agents" id="agents" aria-labelledby="agents-title">
      <JourneyMap section="agents" />
      <div className="section-inner agents-layout">
        <div className="section-copy">
          <div className="section-marker">04</div>
          <h2 id="agents-title">Your agents, working together.</h2>
          <p>Bring the agents you already work with into your support workflow. Connect Codex or Claude through your local computer, and give them the relevant context to help with work that reaches beyond a single reply.</p>
          <p>Choose what they can access and which tasks they can take on. Your team stays in control of the handoff, with work kept in context and replies ready to review.</p>
        </div>
        <div className="agent-workspace">
          <ol className="agent-flow">
            <li className="agent-card">
              <div className="agent-step-icon">
                <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="5" width="24" height="18" rx="2"/>
                  <path d="m9 11 4 3-4 3m8 0h5M12 27h8m-4-4v4"/>
                </svg>
              </div>
              <h3>Pair a computer</h3>
              <p>Connect Codex or Claude on a local computer.</p>
              <span className="agent-meta">Your computer</span>
              <span className="agent-meta">Scoped permissions</span>
            </li>
            <li className="agent-card">
              <div className="agent-step-icon agent-brands">
                <img src="/homepage/media/brands/codex-monochrome.svg" alt="Codex" width="25" height="25" />
                <img src="/homepage/media/brands/claude-asterisk.svg" alt="Claude" width="25" height="25" />
              </div>
              <h3>Let agents investigate</h3>
              <p>Give the task relevant context and a defined scope.</p>
              <span className="agent-meta">Codex · Claude</span>
              <span className="agent-meta">Access you choose</span>
            </li>
            <li className="agent-card">
              <div className="agent-step-icon">
                <svg className="icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 5h18a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H13l-7 5v-5a3 3 0 0 1-3-3V9a4 4 0 0 1 4-4Z"/>
                  <path d="m10 14 4 4 8-8"/>
                </svg>
              </div>
              <h3>Review the reply</h3>
              <p>Keep your team in control of what happens next.</p>
              <span className="agent-meta">Human handoff</span>
              <span className="agent-meta">Revoke access</span>
            </li>
          </ol>
          <figure className="section-art">
            <img src="/homepage/media/human-story-options/team-c-sculpted.png" alt="One traveler reaching down to help another up a rocky climb, rendered as a matte sculpture." loading="lazy" />
          </figure>
        </div>
      </div>
    </section>
  );
}
