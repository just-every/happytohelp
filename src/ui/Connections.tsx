import { useState, type FormEvent } from "react";
import { api } from "./api";
import type { Agent, Workspace } from "./types";
type Props = {
  workspaces: Workspace[];
  agents: Agent[];
  busy: boolean;
  act: (operation: () => Promise<void>) => Promise<void>;
};
export function Connections({ workspaces, agents, busy, act }: Props) {
  const [token, setToken] = useState("");
  const workspace = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    void act(async () => {
      await api("workspaces", data);
      form.reset();
    });
  };
  const connect = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    void act(async () => {
      const result = await api<{ token: string }>("agents", {
        name: data.get("name"),
        workspaceIds: data.getAll("workspaceIds"),
      });
      setToken(result.token);
      form.reset();
    });
  };
  return (
    <main className="settings">
      <h1>Workspaces & agent connections</h1>
      <p className="muted">
        Connect the places your agents can actually access. Each credential is
        scoped and revocable.
      </p>
      <div className="settings-grid">
        <div>
          <section className="panel">
            <h2>Your workspaces</h2>
            {!workspaces.length && (
              <p>
                No workspaces yet. Add the first place you want an agent to
                investigate.
              </p>
            )}
            {workspaces.map((w) => (
              <div className="evidence-item" key={w.id}>
                <h3>{w.name}</h3>
                <p className="muted">{w.path || "No folder hint recorded"}</p>
              </div>
            ))}
            <form onSubmit={workspace}>
              <label htmlFor="workspace-name">Workspace name</label>
              <input id="workspace-name" name="name" required maxLength={100} />
              <label htmlFor="path">Absolute local folder hint</label>
              <input
                id="path"
                name="path"
                placeholder="/path/to/your/workspace"
              />
              <p className="muted">
                A hint does not grant filesystem access. The connected agent
                checks the real folder.
              </p>
              <button className="primary" disabled={busy}>
                Add workspace
              </button>
            </form>
          </section>
        </div>
        <div>
          <section className="panel">
            <h2>Connect an agent</h2>
            <form onSubmit={connect}>
              <label htmlFor="agent-name">Connection name</label>
              <input id="agent-name" name="name" required maxLength={100} />
              <label>Allowed workspaces</label>
              {workspaces.map((w) => (
                <label className="checkbox" key={w.id}>
                  <input type="checkbox" name="workspaceIds" value={w.id} />
                  {w.name}
                </label>
              ))}
              <div className="form-actions">
                <button
                  className="primary"
                  disabled={busy || !workspaces.length}
                >
                  Create scoped credential
                </button>
              </div>
            </form>
            {token && (
              <div className="panel soft">
                <h3>Save this credential now</h3>
                <p>
                  Shown once. Store it in a private file and connect using the
                  included agent helper.
                </p>
                <div className="token">{token}</div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(token).catch(() => {});
                  }}
                >
                  Copy credential
                </button>
                <button onClick={() => setToken("")}>I've saved it</button>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Agent access</h2>
            {!agents.length && <p>No connected agents yet.</p>}
            {agents.map((a) => (
              <div className="evidence-item" key={a.id}>
                <div className="row spread">
                  <h3>{a.name}</h3>
                  <span className="badge">
                    {a.revokedAt
                      ? "Revoked"
                      : a.lastSeenAt
                        ? "Seen by server"
                        : "Awaiting connection"}
                  </span>
                </div>
                <small>
                  {a.lastSeenAt
                    ? new Date(a.lastSeenAt).toLocaleString()
                    : "Credential issued; agent has not contacted this installation."}
                </small>
                {!a.revokedAt && (
                  <p>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await api(`agents/${a.id}`, {}, "DELETE");
                        })
                      }
                    >
                      Revoke access
                    </button>
                  </p>
                )}
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
