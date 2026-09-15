import { useEffect, useState, type FormEvent } from 'react';
import { nativeRequest } from './transport';
import '../dashboard/styles/theme.scss';

type SetupState = 'loading' | 'available' | 'complete' | 'unavailable';

export default function Setup() {
    const [state, setState] = useState<SetupState>('loading');
    const [origin, setOrigin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;
        setOrigin(location.origin);
        nativeRequest('/api/identity/setup').then(result => {
            if (active) setState(result.available ? 'available' : 'complete');
        }).catch(error => {
            if (active) { setError(error.message); setState('unavailable'); }
        });
        return () => { active = false; };
    }, []);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy || state !== 'available') return;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        setError('');
        setBusy(true);
        try {
            const created = await nativeRequest('/api/identity/bootstrap', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            location.assign(`/projects/${encodeURIComponent(created.projectId)}/widget-settings`);
        } catch (error: any) {
            setError(error.message);
            if (error.status === 409) setState('complete');
            setBusy(false);
        }
    };

    return <main className="container py-5"><div className="row justify-content-center"><div className="col-md-7">
        <h1 className="display-4">Set up HappyToHelp</h1>
        {state === 'complete' ? <>
            <p>This HappyToHelp instance already has an owner. Sign in to continue.</p>
            <a className="btn btn-primary" href="/login">Sign in</a>
        </> : <>
            <p>Create the first workspace and its owner account.</p>
            {error && <p className="alert alert-danger" role="alert">{error}</p>}
            {state === 'loading' && <p role="status">Checking setup availability…</p>}
            {state === 'unavailable' && <button className="btn btn-primary" onClick={() => location.reload()}>Retry</button>}
            {state === 'available' && <form method="post" className="workspace-settings" onSubmit={submit}>
                <section className="settings-section">
                    <div className="settings-section__heading"><h2>Workspace and owner</h2></div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="name">Workspace name</label>
                        <input className="form-control" id="name" name="name" required maxLength={200} autoComplete="organization" />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Owner email</label>
                        <input className="form-control" id="email" name="email" type="email" required maxLength={320} autoComplete="username" />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Owner password</label>
                        <input className="form-control" id="password" name="password" type="password" required minLength={12} maxLength={1024} autoComplete="new-password" aria-describedby="password-help" />
                        <p className="form-text" id="password-help">Use at least 12 characters.</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="allowedOrigin">Widget website origin</label>
                        <input className="form-control" id="allowedOrigin" name="allowedOrigin" type="url" required defaultValue={origin} />
                    </div>
                </section>
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create workspace'}</button>
            </form>}
        </>}
    </div></div></main>;
}
