import { useState, type FormEvent } from 'react';
import IdentityFrame from './IdentityFrame';
import SignInDrawing from './SignInDrawing';
import { Alert, Field, NewPasswordField, SubmitButton } from './fields';
import { postJson, useAuthOptions, useHydrated } from './hooks';

export default function Register() {
    const ready = useHydrated();
    const { options, failed } = useAuthOptions();
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState('');
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true); setError('');
        const form = Object.fromEntries(new FormData(event.currentTarget));
        try { await postJson('/api/identity/register', form); setSent(String(form.email)); } catch (failure: any) { setError(failure.message); } finally { setBusy(false); }
    };
    if (sent) return <IdentityFrame>
        <h1>Check your email</h1>
        <p className="id-lede">We sent a verification link to <strong>{sent}</strong>. Open it to confirm your address and create your workspace.</p>
        <div className="id-links"><a href="/login">Sign in</a></div>
    </IdentityFrame>;
    if (failed) return <IdentityFrame><h1>Create your account</h1><Alert>We could not check whether sign-up is open. Reload the page to try again.</Alert><div className="id-links"><a href="/login">Sign in</a></div></IdentityFrame>;
    if (!options) return <IdentityFrame><h1>Create your account</h1><p className="id-lede" role="status">Checking…</p></IdentityFrame>;
    if (!options.registrationAvailable) return <IdentityFrame>
        <h1>Sign-up is closed</h1>
        <p className="id-lede">{options.setupRequired
            ? 'This installation does not take new sign-ups yet. The first owner account is created in setup.'
            : 'This installation does not take new sign-ups. If someone invited you to a workspace, open the link in your invitation. Otherwise, ask the workspace owner to invite you.'}</p>
        <div className="id-links">
            <a className="pill pill--ink" href="/login">Sign in</a>
            {options.setupRequired && <a href="/setup">Set up this installation</a>}
        </div>
    </IdentityFrame>;
    return <IdentityFrame wide drawing={<SignInDrawing />}>
        <h1>Create your account</h1>
        <p className="id-lede">Start a workspace for your support team. We will email you a link to confirm your address.</p>
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <div className="id-row">
                <Field id="name" label="Your name" autoComplete="name" maxLength={200} />
                <Field id="email" label="Email address" type="email" autoComplete="username" maxLength={320} />
            </div>
            <NewPasswordField />
            <div className="id-row">
                <Field id="projectName" label="Workspace name" autoComplete="organization" maxLength={200} />
                <Field id="allowedOrigin" label="Widget website origin" type="url" placeholder="https://example.com" hint="The website where your support widget will run." />
            </div>
            <SubmitButton busy={busy} ready={ready} busyLabel="Creating…">Create account</SubmitButton>
        </form>
        <div className="id-links"><a href="/login">Already have an account? Sign in</a></div>
    </IdentityFrame>;
}
