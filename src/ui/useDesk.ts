import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Agent, Detail, RequestRecord, Session, Workspace } from "./types";
export function useDesk() {
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, select] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const refreshSession = useCallback(
    async () => setSession(await api<Session>("session")),
    [],
  );
  const refresh = useCallback(async () => {
    const [r, w, a] = await Promise.all([
      api<{ requests: RequestRecord[] }>("requests"),
      api<{ workspaces: Workspace[] }>("workspaces"),
      api<{ agents: Agent[] }>("agents"),
    ]);
    setRequests(r.requests);
    setWorkspaces(w.workspaces);
    setAgents(a.agents);
    setReady(true);
    if (selected) setDetail(await api<Detail>(`requests/${selected}`));
  }, [selected]);
  useEffect(() => {
    refreshSession().catch((e) => setError(e.message));
  }, [refreshSession]);
  useEffect(() => {
    if (!session?.authenticated) return;
    let active = true;
    const update = () =>
      refresh().catch((e) => {
        if (active) setError(e.message);
      });
    update();
    const timer = setInterval(update, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session?.authenticated, refresh]);
  const act = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
      if (session?.authenticated) await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  };
  return {
    ready,
    session,
    refreshSession,
    requests,
    workspaces,
    agents,
    selected,
    select,
    detail: detail?.request.id === selected ? detail : null,
    error,
    setError,
    busy,
    act,
    refresh,
  };
}
