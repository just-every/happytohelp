import { useState } from "react";
import { api } from "./api";
import { Auth } from "./Auth";
import { Connections } from "./Connections";
import { CreateRequest } from "./CreateRequest";
import { RequestDetail } from "./RequestDetail";
import { useDesk } from "./useDesk";
export function Desk() {
  const desk = useDesk();
  const [view, setView] = useState<"requests" | "connections">("requests");
  const [create, setCreate] = useState(false);
  const [filter, setFilter] = useState("open");
  if (!desk.session)
    return (
      <main className="auth">
        <h1>HappyToHelp</h1>
        <p>{desk.error || "Loading your workspace…"}</p>
      </main>
    );
  if (!desk.session.authenticated)
    return (
      <Auth
        bootstrap={desk.session.bootstrapRequired}
        onSuccess={desk.refreshSession}
      />
    );
  if (!desk.ready)
    return (
      <main className="auth">
        <h1>HappyToHelp</h1>
        <p>{desk.error || "Loading your requests and connections…"}</p>
      </main>
    );
  return (
    <div className="desk">
      <nav className="rail" aria-label="Main navigation">
        <img src="/cutout-2-7d0a1bb755be.png" alt="HappyToHelp" />
        <button
          className={view === "requests" ? "active" : ""}
          onClick={() => setView("requests")}
        >
          <span className="nav-icon" aria-hidden="true">

          </span>
          Requests
        </button>
        <button
          className={view === "connections" ? "active" : ""}
          onClick={() => setView("connections")}
        >
          <span className="nav-icon" aria-hidden="true">

          </span>
          Connections
        </button>
        <button
          className="bottom"
          onClick={() =>
            void desk.act(async () => {
              await api("auth/signout", {});
              await desk.refreshSession();
            })
          }
        >
          <span className="nav-icon" aria-hidden="true">
            ↪
          </span>
          Sign out
        </button>
      </nav>
      {desk.error && (
        <div className="error global-error" role="alert">
          {desk.error}
          <button onClick={() => desk.setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {view === "connections" ? (
        <Connections
          workspaces={desk.workspaces}
          agents={desk.agents}
          busy={desk.busy}
          act={desk.act}
        />
      ) : (
        <>
          <section className="request-list">
            <div className="list-head">
              <h2>Support requests</h2>
              <button
                aria-label="New request"
                onClick={() =>
                  desk.workspaces.length
                    ? setCreate(true)
                    : setView("connections")
                }
              >
                +
              </button>
            </div>
            <div className="filters">
              {["open", "all", "resolved"].map((f) => (
                <button
                  key={f}
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {desk.requests
              .filter(
                (r) =>
                  filter === "all" ||
                  (filter === "resolved"
                    ? r.status === "resolved"
                    : r.status !== "resolved"),
              )
              .map((r) => (
                <button
                  key={r.id}
                  className={`request-card ${desk.selected === r.id ? "selected" : ""}`}
                  onClick={() => desk.select(r.id)}
                >
                  <span className="avatar">
                    {r.customerEmail.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text">
                    <strong>{r.subject}</strong>
                    <p>{r.body}</p>
                    <span className={`badge ${r.status}`}>
                      {r.status.replaceAll("_", " ")}
                    </span>
                  </span>
                </button>
              ))}
            {!desk.requests.length && (
              <div className="empty">
                <h2>Ready when you are</h2>
                <p>Create your first request to begin.</p>
              </div>
            )}
          </section>
          {desk.detail ? (
            <RequestDetail
              key={desk.detail.request.id}
              detail={desk.detail}
              agents={desk.agents}
              workspaces={desk.workspaces}
              busy={desk.busy}
              act={desk.act}
            />
          ) : (
            <main className="workbench empty">
              <h1>Support, with evidence</h1>
              <p>
                Choose a request to see its context, delegate a bounded task,
                and review what happened.
              </p>
              <button
                className="primary"
                onClick={() =>
                  desk.workspaces.length
                    ? setCreate(true)
                    : setView("connections")
                }
              >
                {desk.workspaces.length
                  ? "Create request"
                  : "Connect your first workspace"}
              </button>
            </main>
          )}
        </>
      )}
      {create && (
        <CreateRequest
          workspaces={desk.workspaces}
          close={() => setCreate(false)}
          created={(id) => {
            setCreate(false);
            desk.select(id);
            void desk.refresh();
          }}
        />
      )}
    </div>
  );
}
