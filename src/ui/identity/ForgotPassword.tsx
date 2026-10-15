import { useState, type FormEvent } from 'react';
import IdentityFrame from './IdentityFrame';
import { Alert, Field, SubmitButton } from './fields';
import { postJson, useAuthOptions, useHydrated, useSignInMail } from './hooks';

export default function ForgotPassword() {
    const ready = useHydrated();
    const { options } = useAuthOptions();
    const { options: mail } = useSignInMail();
    const local = mail?.mailMode === 'local';
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState<{mailMode: string} | null>(null);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true); setError('');
        try { setResult(await postJson('/api/identity/forgot-password', Object.fromEntries(new FormData(event.currentTarget)))); } catch (failure: any) { setError(failure.message); } finally { setBusy(false); }
    };
    if (local) return <IdentityFrame>
        <h1>Local owner sign-in</h1>
        <p className="id-lede"><code>rer dev</code> signs you in automatically as the local owner. Open the app address it prints. Email is suppressed during local development. No email is sent.</p>
        <div className="id-links"><a href="/login">Use your password</a></div>
    </IdentityFrame>;
    if (result) return <IdentityFrame>
        <h1>{result.mailMode === 'local' ? 'Email suppressed' : 'Check your email'}</h1>
        <p className="id-lede">{result.mailMode === 'local' ? 'Email is suppressed during local development. No email was sent. Open the app address printed by rer dev to sign in automatically as the local owner.' : 'If an account exists for that address, check your email for a password reset link. It works for one hour.'}</p>
        <div className="id-links"><a href="/login">Back to sign in</a></div>
    </IdentityFrame>;
    return <IdentityFrame>
        <h1>Reset your password</h1>
        <p className="id-lede">Enter your email address to request a link to choose a new password.</p>
        {options && !options.recoveryAvailable && <p className="id-note" role="status">This installation cannot send password reset emails. The workspace owner must reset your password for you.</p>}
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <Field id="email" label="Email address" type="email" autoComplete="username" maxLength={320} />
            <SubmitButton busy={busy} ready={ready && Boolean(mail)} busyLabel="Sending…">Send reset link</SubmitButton>
        </form>
        <div className="id-links"><a href="/login">Back to sign in</a></div>
    </IdentityFrame>;
}
