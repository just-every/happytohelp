import { useEffect, useState, type FormEvent } from 'react';
import { loginDestination } from '../native/dashboard-path';
import IdentityFrame from './IdentityFrame';
import SignInDrawing from './SignInDrawing';
import { Alert, Field, SubmitButton } from './fields';
import { postJson, useAuthOptions, useSignInMail } from './hooks';

export default function Login() {
    const [magicPath,setMagicPath]=useState('/login/magic');
    useEffect(()=>{const destination=new URLSearchParams(location.search).get('returnTo');if(destination)setMagicPath('/login/magic?returnTo='+encodeURIComponent(loginDestination(destination,location.origin)));},[]);
    const { options } = useAuthOptions();
    const {options:mail}=useSignInMail();
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try {
            const result = await postJson('/api/identity/login', { email: form.get('email'), password: form.get('password') });
            location.assign(loginDestination(new URLSearchParams(location.search).get('returnTo'), location.origin, result.accountOnly));
        } catch (failure: any) { setError(failure.message); setBusy(false); }
    };
    return <IdentityFrame drawing={<SignInDrawing />}>
        <h1>Welcome back</h1>
        <p className="id-lede">Log in to your HappyToHelp workspace.</p>
        {options?.setupRequired && <p className="id-note" role="status">This installation has not been set up yet. <a href="/setup">Set up your workspace</a> to create the first owner account.</p>}
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <Field id="email" label="Email" type="email" autoComplete="username" placeholder="you@example.com" />
            <Field id="password" label="Password" type="password" autoComplete="current-password" placeholder="Your password" />
            <SubmitButton busy={busy} ready={true} busyLabel="Signing in…">Login</SubmitButton>
        </form>
        <div className="id-links">
            <a href="/forgot-password">Forgot your password?</a>
            {mail?.mailMode !== 'unavailable' && mail?.mailMode && <a href={magicPath}>{mail.mailMode==='local'?'Get a local sign-in link':'Email me a sign-in link'}</a>}
            {options?.registrationAvailable && <a href="/register">Create an account</a>}
        </div>
    </IdentityFrame>;
}
