import { useEffect, useState, type FormEvent } from 'react';
import { nativeRequest } from '../native/transport';
import { loginDestination } from '../native/dashboard-path';
import IdentityFrame from './IdentityFrame';
import { Alert, Field, SubmitButton } from './fields';
import { postJson, useAuthOptions, useHydrated } from './hooks';

export default function Login() {
    const ready = useHydrated();
    const { options } = useAuthOptions();
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!import.meta.env.DEV || !import.meta.env.H2H_LOCAL_OWNER_LOGIN) return;
        let active = true;
        setBusy(true);
        nativeRequest('/api/identity/local-owner-session', { method: 'POST' }).then(() => {
            if (active) location.assign(loginDestination(new URLSearchParams(location.search).get('returnTo'), location.origin));
        }).catch((failure: Error) => { if (active) { setError(failure.message); setBusy(false); } });
        return () => { active = false; };
    }, []);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try {
            const result = await postJson('/api/identity/login', { email: form.get('email'), password: form.get('password') });
            location.assign(loginDestination(new URLSearchParams(location.search).get('returnTo'), location.origin, result.accountOnly));
        } catch (failure: any) { setError(failure.message); setBusy(false); }
    };
    return <IdentityFrame>
        <h1>Welcome back</h1>
        <p className="id-lede">Log in to your HappyToHelp workspace.</p>
        {options?.setupRequired && <p className="id-note" role="status">This installation has not been set up yet. <a href="/setup">Set up your workspace</a> to create the first owner account.</p>}
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <Field id="email" label="Email" type="email" autoComplete="username" />
            <Field id="password" label="Password" type="password" autoComplete="current-password" />
            <SubmitButton busy={busy} ready={ready} busyLabel="Signing in…">Login</SubmitButton>
        </form>
        <div className="id-links">
            <a href="/forgot-password">Forgot your password?</a>
            {options?.registrationAvailable && <a href="/register">Create an account</a>}
        </div>
    </IdentityFrame>;
}
