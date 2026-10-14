import { HydrationUnit } from '../../vendor/base/hydration/unit';
import type { SetupInitialState } from '../identity/loaders';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BrandLockup } from '../homepage/BrandLockup';
import { Flourish } from '../homepage/drawings/Flourish';
import SetupNotice from '../identity/SetupNotice';
import { useHydrated } from '../identity/hooks';
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
export default function Setup({ initial }: { initial: SetupInitialState }) {
    const [state, setState] = useState(initial.state);
    const [draft, setDraft] = useState(emptyDraft);
    const [error, setError] = useState(initial.error);
    const tokenRequired = initial.tokenRequired;
    const [busy, setBusy] = useState(false);
    const ready = useHydrated();
    const loaded = useRef(false);
    useEffect(() => {
        if (!loaded.current) { setDraft(readFragment()); loaded.current = true; }
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
        <HydrationUnit><div className="setup-brand"><BrandLockup home="/" /></div></HydrationUnit>
        <HydrationUnit><div className="setup-intro">
            <h1>Set up HappyToHelp</h1>
            <p>Tell us who you are. We’ve filled in the rest, and you can change any of it afterwards.</p>
        </div></HydrationUnit>
        <HydrationUnit><section className="setup-panel" aria-label="Set up HappyToHelp">
            {error && <p className="setup-error" role="alert">{error}</p>}
            <form method="post" onSubmit={submit} noValidate><SetupFields draft={draft} update={update} tokenRequired={tokenRequired} />
                <p className="setup-promise">{promise(name, readsSite)} {readsSite ? 'Both are' : 'It is'} easy to change.</p>
                <footer className="setup-actions"><button type="submit" className="setup-primary" disabled={!ready || busy}>{busy ? 'Creating…' : 'Create workspace'}</button></footer>
            </form>
        </section></HydrationUnit>
        <div className="setup-drawing" ref={cooldownRef('setup-flourish')} aria-hidden="true"><Flourish intro /></div>
    </main></div>;
}
