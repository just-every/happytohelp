import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BrandLockup } from '../homepage/BrandLockup';
import { Flourish } from '../homepage/drawings/Flourish';
import SetupNotice from '../identity/SetupNotice';
import { nativeRequest } from './transport';
import KnownDetails from './setup/KnownDetails';
import SetupFields from './setup/SetupFields';
import SetupSteps from './setup/SetupSteps';
import SetupWindow from './setup/SetupWindow';
import { clearDraft, emptyDraft, loadDraft, saveDraft, type SetupDraft } from './setup/draft';
import '../homepage/outfit.css';
import '../homepage/brand-tokens.css';
import './setup/setup.css';
import './setup/setup-form.css';
import './setup/setup-drawings.css';

type SetupState = 'loading' | 'available' | 'complete' | 'unavailable';
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
            // A claimed installation sends its signed-in owner on to the workspace (first-run steps, then the inbox).
            if (result.signedIn) { if (active) location.replace('/projects?onboarding=setup'); return; }
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
            const section=new URLSearchParams(location.search).get('onboarding')==='setup'?'activation':'widget-settings';
            location.assign(`/projects/${encodeURIComponent(created.projectId)}/${section}`);
        } catch (error: any) {
            setError(error.message);
            if (error.status === 409) setState('complete');
            setBusy(false);
        }
    };
    // Setup has a wizard only while nobody has claimed the installation; every other state is a plain public page.
    if (state !== 'available') return <SetupNotice state={state} error={error} />;
    // One grid, read in this order on a phone: the welcome, the step and its form, then what is already known and the drawing.
    // From tablet width up, the welcome, the known details and the drawing take the left column and the step the right.
    return <div className="h2h-setup"><main className="setup-page">
        <div className="setup-brand"><BrandLockup home="/" /></div>
        <div className="setup-intro">
            <h1>A new home for <span>helpful conversations.</span></h1>
            <p>Let’s make this workspace yours. Review what’s already known, then add the few details we still need.</p>
        </div>
        <section className="setup-panel" aria-label="Set up HappyToHelp">
            <SetupSteps step={step} />
            <h2>{['A little about you', 'Make it your workspace', 'Ready when you are'][step]}</h2>
            <p className="setup-lede">{['Your account will own this installation.', 'Choose your workspace name, website and colour.', 'Check your details before we create your workspace.'][step]}</p>
            {error && <p className="setup-error" role="alert">{error}</p>}
            <form onSubmit={submit}><SetupFields draft={draft} update={update} tokenRequired={tokenRequired} step={step} />
                <footer className="setup-actions"><button className="setup-secondary" type="button" disabled={busy} onClick={() => { if (step) setStep(step - 1); else { saveDraft(draft); setSaved(true); } }}>{step ? 'Back' : 'Save for later'}</button><button className="setup-primary" disabled={busy}>{busy ? 'Creating…' : step === 2 ? 'Create workspace' : step === 1 ? 'Review setup' : 'Continue'}</button></footer>
                {saved && <p role="status" className="setup-status">Details saved in this browser tab. Passwords and setup tokens are never saved.</p>}
            </form>
        </section>
        <KnownDetails draft={draft} onEdit={() => setStep(1)} />
        <div className="setup-drawing" aria-hidden="true">{step ? <SetupWindow name={draft.name} colour={draft.primaryColor} /> : <Flourish />}</div>
    </main></div>;
}
