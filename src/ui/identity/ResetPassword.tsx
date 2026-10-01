import { useState, type FormEvent } from 'react';
import IdentityFrame from './IdentityFrame';
import LinkProblem from './LinkProblem';
import { Alert, NewPasswordField, SubmitButton } from './fields';
import { postJson, useHydrated, useLinkStatus } from './hooks';

export default function ResetPassword() {
    const ready = useHydrated();
    const { token, info, failure } = useLinkStatus('reset');
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true); setError('');
        try { await postJson('/api/identity/accept-token', { token, password: new FormData(event.currentTarget).get('password') }); setDone(true); } catch (problem: any) { setError(problem.message); } finally { setBusy(false); }
    };
    if (done) return <IdentityFrame>
        <h1>Password updated</h1>
        <p className="id-lede">Sign in with your new password. Any other sessions on your account were signed out.</p>
        <div className="id-actions"><a className="pill pill--ink" href="/login">Sign in</a></div>
    </IdentityFrame>;
    if (!info) return <IdentityFrame><h1>Choose a new password</h1>{failure ? <Alert>{failure}</Alert> : <p className="id-lede" role="status">Checking your link…</p>}</IdentityFrame>;
    if (info.state !== 'valid') return <IdentityFrame><LinkProblem state={info.state} noun="password reset"><a className="pill pill--ink" href="/forgot-password">Request a new link</a><a href="/login">Sign in</a></LinkProblem></IdentityFrame>;
    return <IdentityFrame>
        <h1>Choose a new password</h1>
        <p className="id-lede">For <strong>{info.email}</strong>.</p>
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <NewPasswordField label="New password" />
            <SubmitButton busy={busy} ready={ready} busyLabel="Saving…">Set new password</SubmitButton>
        </form>
        <div className="id-links"><a href="/login">Back to sign in</a></div>
    </IdentityFrame>;
}
