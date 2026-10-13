import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BrandLockup } from '../homepage/BrandLockup';
import { Flourish } from '../homepage/drawings/Flourish';
import SetupNotice from '../identity/SetupNotice';
import { publicHost } from '../../modules/identity/workspace-defaults';
import { nativeRequest } from './transport';
import SetupFields from './setup/SetupFields';
import { cooldownRef } from './drawings/cooldown';
import { derivedName, emptyDraft, problem, readFragment, submittedWebsite, type SetupDraft } from './setup/draft';
import '../homepage/outfit.css';
import '../homepage/brand-tokens.css';
import './setup/setup.css';
import './setup/setup-form.css';
import './setup/setup-drawings.css';

// The colour is only taken from a public website; a local or internal address is never read, so it promises the name alone.
const promise = (name: string | null, readsSite: boolean) => readsSite
    ? (name ? <>We’ll call your workspace <b>{name}</b> and pick a colour from your site.</> : <>We’ll name your workspace and pick a colour from your site.</>)
    : (name ? <>We’ll call your workspace <b>{name}</b>.</> : <>We’ll name your workspace for you.</>);
type SetupState = 'loading' | 'available' | 'complete' | 'unavailable';
export default function Setup() {
    const [state, setState] = useState<SetupState>('loading');
    const [draft, setDraft] = useState(emptyDraft);
    const [error, setError] = useState('');
    const [tokenRequired, setTokenRequired] = useState(false);
    const [busy, setBusy] = useState(false);
    const loaded = useRef(false);
    useEffect(() => {
        let active = true;
        if (!loaded.current) { setDraft(readFragment()); loaded.current = true; }
        nativeRequest('/api/identity/setup').then(result => {
            // A claimed installation sends its signed-in owner on to the workspace (first-run steps, then the inbox).
            if (result.signedIn) { if (active) location.replace('/projects?onboarding=setup'); return; }
            if (active) { setState(result.available ? 'available' : 'complete'); setTokenRequired(Boolean(result.tokenRequired)); }
        }).catch(error => { if (active) { setError(error.message); setState('unavailable'); } });
        return () => { active = false; };
    }, []);
    const update = (key: keyof SetupDraft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy || state !== 'available') return;
        const invalid = problem(draft, tokenRequired);
        if (invalid) { setError(invalid); return; }
        setError(''); setBusy(true);
        try {
            const created = await nativeRequest('/api/identity/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: draft.email.trim(), password: draft.password, allowedOrigin: submittedWebsite(draft), ...(tokenRequired || draft.setupToken ? { setupToken: draft.setupToken } : {}) }) });
            location.assign(`/projects/${encodeURIComponent(created.projectId)}/activation`);
        } catch (error: any) {
            setError(error.message);
            if (error.status === 409) setState('complete');
            setBusy(false);
        }
    };
    // Setup has a form only while nobody has claimed the installation; every other state is a plain public page.
    if (state !== 'available') return <SetupNotice state={state} error={error} />;
    const name = derivedName(draft), readsSite = Boolean(publicHost(submittedWebsite(draft)));
    // One grid, read in this order on a phone: the welcome, the form, then the drawing. From tablet width up, the welcome and
    // the drawing take the left column and the form the right.
    return <div className="h2h-setup"><main className="setup-page">
        <div className="setup-brand"><BrandLockup home="/" /></div>
        <div className="setup-intro">
            <h1>Set up HappyToHelp</h1>
            <p>Tell us who you are. We’ve filled in the rest, and you can change any of it afterwards.</p>
        </div>
        <section className="setup-panel" aria-label="Set up HappyToHelp">
            {error && <p className="setup-error" role="alert">{error}</p>}
            <form onSubmit={submit} noValidate><SetupFields draft={draft} update={update} tokenRequired={tokenRequired} />
                <p className="setup-promise">{promise(name, readsSite)} {readsSite ? 'Both are' : 'It is'} easy to change.</p>
                <footer className="setup-actions"><button type="submit" className="setup-primary" disabled={busy}>{busy ? 'Creating…' : 'Create workspace'}</button></footer>
            </form>
        </section>
        <div className="setup-drawing" ref={cooldownRef('setup-flourish')} aria-hidden="true"><Flourish /></div>
    </main></div>;
}
