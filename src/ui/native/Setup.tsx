import { useEffect, useRef, useState, type FormEvent } from 'react';
import { nativeRequest } from './transport';
import SetupFields from './setup/SetupFields';
import SetupNotice from '../identity/SetupNotice';
import { clearDraft, emptyDraft, loadDraft, saveDraft, type SetupDraft } from './setup/draft';
import './setup/setup.css';

type SetupState = 'loading' | 'available' | 'complete' | 'unavailable';
const steps = ['Your details', 'Workspace', 'Review'];
export default function Setup() {
    const [state, setState] = useState<SetupState>('loading');
    const [draft, setDraft] = useState(emptyDraft);
    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [tokenRequired, setTokenRequired] = useState(false);
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(false);
    const loaded = useRef(false);
    useEffect(() => {
        let active = true;
        if (!loaded.current) { setDraft(loadDraft()); loaded.current = true; }
        nativeRequest('/api/identity/setup').then(result => {
            if (active) { setState(result.available ? 'available' : 'complete'); setTokenRequired(Boolean(result.tokenRequired)); }
        }).catch(error => { if (active) { setError(error.message); setState('unavailable'); } });
        return () => { active = false; };
    }, []);
    const update = (key: keyof SetupDraft, value: string) => { setDraft(current => ({ ...current, [key]: value })); setSaved(false); };
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy || state !== 'available') return;
        setError(''); saveDraft(draft);
        if (step < 2) { setStep(step + 1); return; }
        if (!draft.ownerName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) || draft.password.length < 12 || (tokenRequired && !draft.setupToken)) { setStep(0); setError('Complete your owner details before creating the workspace.'); return; }
        if (!draft.name.trim() || !/^#[0-9a-f]{6}$/i.test(draft.primaryColor)) { setStep(1); setError('Complete your workspace details before creating it.'); return; }
        setBusy(true);
        try {
            const created = await nativeRequest('/api/identity/bootstrap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
            clearDraft();
            location.assign(`/projects/${encodeURIComponent(created.projectId)}/widget-settings`);
        } catch (error: any) {
            setError(error.message);
            if (error.status === 409) setState('complete');
            setBusy(false);
        }
    };
    // Setup has a wizard only while nobody has claimed the installation; every other state is a plain public page.
    if (state !== 'available') return <SetupNotice state={state} error={error} />;
    return <main className="setup-scene"><div className="setup-layout"><aside className="setup-sidebar">
        <a className="setup-brand" href="/">HappyToHelp</a>
        <h1>A new home for <span>helpful conversations.</span></h1>
        <p>Let’s make this workspace yours. Review what’s already known, then add the few details we still need.</p>
        <section className="setup-known" aria-label="Known details"><header><h2>Known details</h2><button type="button" onClick={() => setStep(1)}>Edit</button></header><dl>
            <div><dt>Product</dt><dd>HappyToHelp</dd></div><div><dt>Workspace</dt><dd>{draft.name || 'Not set yet'}</dd></div>
            <div><dt>Runtime</dt><dd>Cloudflare Worker</dd></div><div><dt>Installation</dt><dd>{draft.allowedOrigin ? new URL(location.href).origin : 'Checking…'}</dd></div>
        </dl><small>The app is running here. Hosting and repository access are managed by your installation tools.</small></section>
    </aside><section className="setup-panel" aria-label="Set up HappyToHelp">
        <nav aria-label="Setup progress"><ol className="setup-steps">{steps.map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol></nav>
        <h2>{['A little about you', 'Make it your workspace', 'Ready when you are'][step]}</h2>
        <p>{['Your account will own this installation.', 'Choose your workspace name, website and colour.', 'Check your details before we create your workspace.'][step]}</p>
        {error && <p className="setup-error" role="alert">{error}</p>}
        <form onSubmit={submit}><SetupFields draft={draft} update={update} tokenRequired={tokenRequired} step={step} />
            <footer className="setup-actions"><button className="setup-secondary" type="button" disabled={busy} onClick={() => { if (step) setStep(step - 1); else { saveDraft(draft); setSaved(true); } }}>{step ? 'Back' : 'Save for later'}</button><button className="setup-primary" disabled={busy}>{busy ? 'Creating…' : step === 2 ? 'Create workspace' : step === 1 ? 'Review setup' : 'Continue'}</button></footer>
            {saved && <p role="status" className="setup-note">Details saved in this browser tab. Passwords and setup tokens are never saved.</p>}
        </form>
    </section></div></main>;
}
