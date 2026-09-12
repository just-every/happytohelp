import { ReplyReview } from "./ReplyReview";
import { useState, type FormEvent } from "react";
import { api } from "./api";
import {
  modeDescriptions,
  modeLabels,
  type Agent,
  type Detail,
  type Mode,
  type Workspace,
} from "./types";
type Props = {
  detail: Detail;
  agents: Agent[];
  workspaces: Workspace[];
  busy: boolean;
  act: (operation: () => Promise<void>) => Promise<void>;
};
export function RequestDetail({
  detail,
  agents,
  workspaces,
  busy,
  act,
}: Props) {
  const [mode, setMode] = useState<Mode>("investigate");
  const [showDelegate, setShowDelegate] = useState(false);
  const { request, jobs, events, replies } = detail;
  const job = jobs[0];
  const active =
    job && ["queued", "running", "needs_input"].includes(job.status);
  const workspace = workspaces.find((w) => w.id === request.workspaceId);
  function delegate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    void act(async () => {
      await api(`requests/${request.id}/delegate`, { ...data, mode });
      setShowDelegate(false);
    });
  }
  function input(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    void act(async () => {
      await api(`jobs/${job.id}/input`, Object.fromEntries(new FormData(form)));
      form.reset();
    });
  }
  const result = job?.result;
  const question = result?.question;
  return (
    <>
      <main className="workbench">
        <div className="workbench-header">
          <h1>{request.subject}</h1>
          <span className={`badge ${request.status}`}>
            {request.status.replaceAll("_", " ")}
          </span>
        </div>
        <div className="customer">
          <span className="avatar">
            {request.customerEmail.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{request.customerEmail}</strong>
            <div className="muted">
              {request.id.slice(0, 8)} ·{" "}
              {new Date(request.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
        <p className="message">{request.body}</p>
        {!active && (!job || showDelegate) && request.status !== "resolved" && (
          <section className="panel soft">
            <h2>Delegate a bounded task</h2>
            <form onSubmit={delegate}>
              <div
                className="authority"
                role="group"
                aria-label="Agent authority"
              >
                {(Object.keys(modeLabels) as Mode[]).map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={mode === m ? "active" : ""}
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {modeLabels[m]}
                  </button>
                ))}
              </div>
              <p>{modeDescriptions[mode]}</p>
              <label htmlFor="instructions">Instructions and limits</label>
              <textarea
                id="instructions"
                name="instructions"
                required
                maxLength={12000}
                placeholder="What should the agent investigate or change, and how should it verify the outcome?"
              />
              <label htmlFor="agentId">Agent connection</label>
              <select id="agentId" name="agentId" required>
                <option value="">Choose a scoped connection</option>
                {agents
                  .filter(
                    (a) =>
                      !a.revokedAt &&
                      a.workspaceIds.includes(request.workspaceId),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <div className="form-actions">
                <button className="primary" disabled={busy}>
                  Delegate to agent
                </button>
              </div>
            </form>
          </section>
        )}
        {job && (
          <section className="panel soft">
            <div className="row spread">
              <h2>{modeLabels[job.mode]} authority</h2>
              <span className={`badge ${job.status}`}>
                {job.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="message">{job.instructions}</p>
            <small>{modeDescriptions[job.mode]}</small>
            {!active && request.status !== "resolved" && (
              <p>
                <button onClick={() => setShowDelegate(true)}>
                  Delegate follow-up
                </button>
              </p>
            )}
            {active && (
              <p>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api(`jobs/${job.id}/cancel`, {});
                    })
                  }
                >
                  Cancel delegation
                </button>
              </p>
            )}
          </section>
        )}
        <h2>Resolution progress</h2>
        {!events.length ? (
          <p className="muted">
            Progress appears when an agent claims this request.
          </p>
        ) : (
          <div className="timeline">
            {events.map((event) => (
              <div className="event" key={event.id}>
                <h3>{event.kind.replaceAll("_", " ")}</h3>
                <small>{new Date(event.createdAt).toLocaleString()}</small>
                {event.message && <p>{event.message}</p>}
              </div>
            ))}
          </div>
        )}
        {job?.status === "needs_input" && (
          <section className="panel soft">
            <h2>The agent needs your input</h2>
            <p>
              {question ||
                "Read the latest progress and answer the agent’s question."}
            </p>
            <form onSubmit={input}>
              <label htmlFor="answer">Your answer</label>
              <textarea id="answer" name="message" required />
              <div className="form-actions">
                <button className="primary" disabled={busy}>
                  Send input and resume
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
      <aside className="evidence-sidebar">
        <section className="panel">
          <h2>Owner workspace</h2>
          <h3>{workspace?.name}</h3>
          <p className="muted">
            {workspace?.path || "No folder hint supplied"}
          </p>
          <p>
            The connected agent uses its actual workspace access. A credential
            limits which requests it can claim.
          </p>
        </section>
        <section className="panel">
          <h2>Evidence review</h2>
          {result ? (
            <>
              <span className={`badge ${result.verified ? "completed" : ""}`}>
                {result.verified
                  ? "Agent reports verified"
                  : "Verification incomplete"}
              </span>
              <p>{result.summary}</p>
              {result.actions?.map((action, i) => (
                <div className="evidence-item" key={i}>
                  <h3>{action.description}</h3>
                  <p>{action.evidence}</p>
                </div>
              ))}
              {result.attachment_ids?.map((id) => (
                <p key={id}>
                  <a
                    href={`/api/attachments/${id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View evidence attachment
                  </a>
                </p>
              ))}
              {job?.status === "completed" && request.status !== "resolved" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api(`jobs/${job.id}/review`, { action: "resolve" });
                    })
                  }
                >
                  Evidence reviewed · Resolve
                </button>
              )}
            </>
          ) : (
            <p className="muted">
              No result submitted yet. Completed work must include verification.
            </p>
          )}
        </section>
        {replies.map((reply) => (
          <ReplyReview
            key={reply.id}
            reply={reply}
            jobId={reply.jobId}
            current={reply.jobId === job?.id}
            busy={busy}
            act={act}
          />
        ))}
      </aside>
    </>
  );
}
