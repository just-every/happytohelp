import { useState } from 'react';
import IdentityFrame from './IdentityFrame';
import LinkProblem from './LinkProblem';
import { Alert } from './fields';
import { postJson, useHydrated, useLinkStatus } from './hooks';

// Confirming is an explicit action: opening the link only reads it, so mail scanners that fetch links consume nothing.
export default function VerifyEmail() {
    const ready = useHydrated();
    const { token, info, failure } = useLinkStatus('verify-email');
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
    const confirm = async () => {
        setBusy(true); setError('');
        try { await postJson('/api/identity/verify-email', { token }); setDone(true); } catch (problem: any) { setError(problem.message); } finally { setBusy(false); }
    };
    if (done) return <IdentityFrame>
        <h1>Email confirmed</h1>
        <p className="id-lede">Your workspace <strong>{info?.workspace}</strong> is ready. Sign in with the password you chose.</p>
        <div className="id-actions"><a className="pill pill--ink" href="/login">Sign in</a></div>
    </IdentityFrame>;
    if (!info) return <IdentityFrame><h1>Confirm your email</h1>{failure ? <Alert>{failure}</Alert> : <p className="id-lede" role="status">Checking your link…</p>}</IdentityFrame>;
    if (info.state !== 'valid') return <IdentityFrame><LinkProblem state={info.state} noun="verification"><a className="pill pill--ink" href="/login">Sign in</a><a href="/register">Sign up again</a></LinkProblem></IdentityFrame>;
    return <IdentityFrame>
        <h1>Confirm your email</h1>
        <p className="id-lede">Confirm <strong>{info.email}</strong> to create your workspace.</p>
        <dl className="id-facts"><div><dt>Workspace</dt><dd>{info.workspace}</dd></div><div><dt>Email</dt><dd>{info.email}</dd></div></dl>
        <Alert>{error}</Alert>
        <div className="id-actions"><button className="pill pill--ink" disabled={busy || !ready} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm email'}</button></div>
        <div className="id-links"><a href="/login">Sign in</a></div>
    </IdentityFrame>;
}
