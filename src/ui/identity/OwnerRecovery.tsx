import { useState, type FormEvent } from 'react';
import IdentityFrame from './IdentityFrame';
import { Alert, Field, SubmitButton } from './fields';
import { postJson } from './hooks';

/** An owner who lost every second factor signs in with the installation's owner recovery key, set through rer. */
export default function OwnerRecovery() {
    const [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try { const result = await postJson('/api/identity/owner-recovery', { email: form.get('email'), password: form.get('password'), recoveryKey: form.get('recoveryKey') }); location.assign(result.destination); }
        catch (failure: any) { setError(failure.message); setBusy(false); }
    };
    return <IdentityFrame>
        <h1>Recover owner access</h1>
        <p className="id-lede">For a workspace owner who lost every second factor. Email alone never recovers an account.</p>
        <p className="id-note">Whoever runs this installation sets a one-time owner recovery key with <code>rer deploy --set-secret H2H_OWNER_RECOVERY_KEY</code>. A local install keeps it in its private <code>.dev.vars</code> file. Recovery removes your old factors and signs you out everywhere; set up a new one right after.</p>
        <Alert>{error}</Alert>
        <form method="post" onSubmit={submit}>
            <Field id="email" label="Owner email" type="email" autoComplete="username" />
            <Field id="password" label="Password" type="password" autoComplete="current-password" />
            <Field id="recoveryKey" label="Installation recovery key" type="password" autoComplete="off" minLength={32} hint="At least 32 characters. Each key works once." />
            <SubmitButton busy={busy} ready={true} busyLabel="Recovering…">Recover access</SubmitButton>
        </form>
        <div className="id-links"><a href="/login">Back to login</a></div>
    </IdentityFrame>;
}
