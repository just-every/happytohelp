import { useState, type FormEvent } from 'react';
import IdentityFrame from './IdentityFrame';
import { Alert, Field, SubmitButton } from './fields';
import { postJson, useAuthOptions, useHydrated } from './hooks';

export default function ForgotPassword() {
    const ready = useHydrated();
    const { options } = useAuthOptions();
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true); setError('');
        try { await postJson('/api/identity/forgot-password', Object.fromEntries(new FormData(event.currentTarget))); setSent(true); } catch (failure: any) { setError(failure.message); } finally { setBusy(false); }
    };
    if (sent) return <IdentityFrame>
        <h1>Check your email</h1>
        <p className="id-lede">If an account exists for that address, a password reset link is on its way. It works for one hour.</p>
        <div className="id-links"><a href="/login">Back to sign in</a></div>
    </IdentityFrame>;
    return <IdentityFrame>
        <h1>Reset your password</h1>
        <p className="id-lede">Enter your email address and we will send you a link to choose a new password.</p>
        {options && !options.recoveryAvailable && <p className="id-note" role="status">This installation cannot send password reset emails. The workspace owner must reset your password for you.</p>}
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <Field id="email" label="Email address" type="email" autoComplete="username" maxLength={320} />
            <SubmitButton busy={busy} ready={ready} busyLabel="Sending…">Send reset link</SubmitButton>
        </form>
        <div className="id-links"><a href="/login">Back to sign in</a></div>
    </IdentityFrame>;
}
