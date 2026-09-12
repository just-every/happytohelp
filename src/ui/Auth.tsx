import { useState, type FormEvent } from "react";
import { api } from "./api";
export function Auth({
  bootstrap,
  onSuccess,
}: {
  bootstrap: boolean;
  onSuccess: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(bootstrap ? "auth/bootstrap" : "auth/signin", values);
      await onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <img src="/cutout-2-7d0a1bb755be.png" alt="" />
      <h1>{bootstrap ? "Make it your workspace" : "Welcome to HappyToHelp"}</h1>
      <p className="muted">
        {bootstrap
          ? "Create the owner account for this installation."
          : "Sign in to follow requests and review agent evidence."}
      </p>
      <form onSubmit={submit}>
        {bootstrap && (
          <>
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
            />
          </>
        )}
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={12}
          required
          autoComplete={bootstrap ? "new-password" : "current-password"}
        />
        {bootstrap && (
          <>
            <label htmlFor="bootstrapToken">Deployment bootstrap token</label>
            <input
              id="bootstrapToken"
              name="bootstrapToken"
              type="password"
              required
              autoComplete="off"
            />
            <small>
              From your private deployment settings. Required only for the first
              owner.
            </small>
          </>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : bootstrap
              ? "Create owner account"
              : "Sign in"}
        </button>
      </form>
    </main>
  );
}
