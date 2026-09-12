import { useState, type FormEvent } from "react";
import { api } from "./api";
import type { Workspace, RequestRecord } from "./types";
export function CreateRequest({
  workspaces,
  close,
  created,
}: {
  workspaces: Workspace[];
  close: () => void;
  created: (id: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api<{ request: RequestRecord }>(
        "requests",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      created(response.request.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-title"
      >
        <h1 id="new-title">Create a support request</h1>
        <p className="muted">
          Capture what the customer needs. You choose the agent's authority
          after creating the request.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="workspace">Workspace</label>
          <select id="workspace" name="workspaceId" required>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" required maxLength={500} />
          <label htmlFor="customer">Customer email</label>
          <input id="customer" name="customerEmail" type="email" required />
          <label htmlFor="body">Customer request</label>
          <textarea id="body" name="body" required maxLength={20000} />
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={busy || !workspaces.length}>
              Create request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
