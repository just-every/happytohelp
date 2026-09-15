import React, { useEffect, useState } from 'react';
import AvatarUpload from './AvatarUpload';
import { PageHeaderTabs } from '../PageHeader';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';

const requestBody = value => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
export default function AssistantsPage({ projectId, recordId }) {
    const base = `/api/management/projects/${projectId}`;
    const href = `/projects/${projectId}/ais`;
    const [items, setItems] = useState(null), [settings, setSettings] = useState(null), [draft, setDraft] = useState(null);
    const [error, setError] = useState(''), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false);
    useEffect(() => {
        let active = true;
        setItems(null); setDraft(null); setSettings(null); setError(''); setSaved(false);
        Promise.all([nativeRequest(`${base}/ais`), nativeRequest(`${base}/settings`), recordId && recordId !== 'create' ? nativeRequest(`${base}/ais/${recordId}`) : Promise.resolve(null)])
            .then(([list, policy, record]) => {
                if (!active) return;
                setItems(list.data); setSettings(policy.data);
                if (recordId) setDraft(recordId === 'create' ? { name: '', role: '', model: '', prompt: '', is_enabled: true, is_animated: false } : record.data);
            }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [base, recordId]);
    const action = async work => {
        setBusy(true); setError(''); setSaved(false);
        try { await work(); setSaved(true); } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const toggle = item => action(async () => {
        const result = await nativeRequest(`${base}/ais/${item.id}`, { method: 'PUT', ...requestBody({ is_enabled: !item.is_enabled }) });
        setItems(rows => rows.map(row => row.id === item.id ? result.data : row));
    });
    const saveDefaults = event => {
        event.preventDefault();
        if (invalidDefaults) { setError('Choose an enabled assistant or None for each default responder before saving.'); return; }
        action(async () => {
            const patch = { default_visitor_ai_id: settings.default_visitor_ai_id || '-', default_verified_user_ai_id: settings.default_verified_user_ai_id || '-', is_human_response_enabled: settings.is_human_response_enabled !== false };
            const result = await nativeRequest(`${base}/ai`, { method: 'PUT', ...requestBody(patch) });
            setSettings(current => ({ ...current, ...result.data }));
        });
    };
    const saveAssistant = event => {
        event.preventDefault();
        action(async () => {
            const payload = { ...draft };
            if (!payload.avatar_url) delete payload.avatar_url;
            const result = await nativeRequest(`${base}/ais${draft.id ? `/${draft.id}` : ''}`, { method: draft.id ? 'PUT' : 'POST', ...requestBody(payload) });
            if (!draft.id) { location.assign(`${href}/${result.data.id}`); return; }
            setDraft(result.data);
        });
    };
    const field = (name, label, type = 'text', required = false) => <Field {...{ name, label, type, required }} value={draft[name]} onChange={(key, value) => { setDraft(current => ({ ...current, [key]: value })); setSaved(false); }}/>;
    const defaultNames = ['default_visitor_ai_id', 'default_verified_user_ai_id'];
    const invalidDefaults = defaultNames.some(name => settings?.[name] && settings[name] !== '-' && !(items || []).some(item => item.id === settings[name] && item.is_enabled));
    const responders = [{ value: '-', label: 'None' }, ...(items || []).filter(item => item.is_enabled).map(item => ({ value: item.id, label: item.role || item.name }))];
    return <div className="workspace-settings"><PageHeaderTabs><nav aria-label="AI settings"><ul className="nav nav-tabs header-tabs">{[['ais','AI'],['datasets','Training'],['training-runs','Evaluation runs']].map(([path,label])=><li className="nav-item" key={path}><a className={`nav-link ${path==='ais'?'active':''}`} aria-current={path==='ais'?'page':undefined} href={`/projects/${projectId}/${path}`}>{label}</a></li>)}</ul></nav></PageHeaderTabs><Feedback {...{ error, saved }}/>
        {!items && !error && <p role="status">Loading assistants…</p>}
        {recordId && draft && <form onSubmit={saveAssistant}>
            <Section title="Identity" description="Set the name, role, and avatar shown for this assistant."><div className="settings-grid">{field('name', 'Name', 'text', true)}{field('role', 'Role', 'text', true)}<AvatarUpload projectId={projectId} value={draft.avatar_url} onChange={value => setDraft(current => ({ ...current, avatar_url: value }))}/></div></Section>
            <Section title="Behavior" description="Define how this assistant responds to conversations.">{field('model', 'Model', 'text', true)}{field('prompt', 'Prompt', 'textarea', true)}{field('is_animated', 'Animated', 'checkbox')}{field('is_enabled', 'Enabled', 'checkbox')}</Section>
            <div className="settings-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><a className="btn btn-white ms-2" href={href}>Cancel</a>{draft.id && <button type="button" className="btn btn-outline-danger ms-2" disabled={busy} onClick={() => action(async () => { await nativeRequest(`${base}/ais/${draft.id}`, { method: 'DELETE' }); location.assign(href); })}>Delete</button>}</div>
        </form>}
        {!recordId && items && settings && <>
            <Section title="Assistants" description="Choose which assistants can respond in this project.">
                {items.map(item => <section className="settings-section" key={item.id}><div className="row align-items-center g-3"><div className="col"><div className="settings-identity">{item.avatar_url ? <img src={item.avatar_url} className="avatar avatar-sm" alt=""/> : <i className="fe fe-cpu" aria-hidden="true"/>}<div><h3>{item.name}</h3><p className="settings-note mb-0">{item.role}</p></div></div></div><div className="col-auto"><a className="btn btn-sm btn-white" href={`${href}/${item.id}`}>Customize</a></div><div className="col-auto"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={Boolean(item.is_enabled)} disabled={busy} aria-label={`Enable ${item.name} assistant`} onChange={() => toggle(item)}/></div></div></div></section>)}
                {!items.length && <p className="settings-note">No assistants have been added to this project.</p>}
                <a className="btn btn-sm btn-white" href={`${href}/create`}>Add assistant</a>
            </Section>
            <form onSubmit={saveDefaults}><Section title="Responder defaults" description="Set the default responder for each visitor type.">
                <Field name="is_human_response_enabled" label="Allow human responders" type="checkbox" value={settings.is_human_response_enabled !== false} onChange={(key, value) => { setSettings(current => ({ ...current, [key]: value })); setSaved(false); }}/>
                <div className="settings-grid mt-4">{[['default_visitor_ai_id', 'Default responder for non-logged in users'], ['default_verified_user_ai_id', 'Default responder for logged in users']].map(([name, label]) => <div className="form-group" key={name}><label htmlFor={name} className="form-label">{label}</label><select id={name} name={name} className="form-select" value={settings[name] || '-'} onChange={event => { setSettings(current => ({ ...current, [name]: event.target.value })); setSaved(false); }}>{settings[name] && settings[name] !== '-' && !responders.some(option => option.value === settings[name]) && <option value={settings[name]} disabled>{items.find(item => item.id === settings[name])?.name || 'Previous assistant'} (unavailable — choose a responder)</option>}{responders.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>)}</div>
                {invalidDefaults && <p role="alert" className="text-danger">Choose an enabled assistant or None for each default responder before saving.</p>}<div className="settings-actions"><button className="btn btn-primary" disabled={busy || invalidDefaults}>{busy ? 'Saving…' : 'Save'}</button></div>
            </Section></form>
        </>}
    </div>;
}
