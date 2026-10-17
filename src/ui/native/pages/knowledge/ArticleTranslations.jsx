import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../../transport';
import { useUnsavedChanges } from '../../NavigationGuard';
import { Field, Feedback } from '../forms';
import { ArticleMarkdownEditor } from './article-editor-code';

export default function ArticleTranslations({ projectId, articleId }) {
    const [experience, setExperience] = useState(null);
    const [locale, setLocale] = useState('');
    const [draft, setDraft] = useState(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [dirty, setDirtyState] = useState(false);
    const [revision, setRevision] = useState(0);
    const { markDirty, markSaved } = useUnsavedChanges();
    const path = `/api/knowledge/${projectId}/articles/${articleId}/translations/`;
    useEffect(() => {
        let active = true;
        nativeRequest(`/api/knowledge/${projectId}/experience`).then(result => { if (active) setExperience(result); }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [projectId]);
    useEffect(() => {
        if (!locale) return;
        let active = true;
        setDraft(null); setError(''); setSaved(false);
        nativeRequest(path + encodeURIComponent(locale)).then(result => {
            if (!active) return;
            setDraft(result.translation || result);
            setRevision(value => value + 1);
        }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [path, locale]);
    const change = (name, value) => {
        markDirty(); setDirtyState(true); setSaved(false);
        setDraft(current => ({ ...current, [name]: value, ...(name !== 'reviewStatus' ? {reviewStatus: 'draft'} : {}) }));
    };
    const save = async event => {
        event.preventDefault(); setError(''); setBusy(true);
        try {
            await nativeRequest(path + encodeURIComponent(locale), {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(draft)});
            markSaved(); setDirtyState(false); setSaved(true);
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const locales = experience?.locales?.filter(value => value !== experience.defaultLocale) || [];
    return <section className="knowledge-governance-group">
        <h2>Translations</h2>
        {experience && <p className="settings-note">Source locale: {experience.defaultLocale}</p>}
        <p className="settings-note">Reviewed translations appear when the source article is published. Editing a translation returns it to draft; readers keep seeing the previous reviewed translation until the new revision is reviewed.</p>
        <Feedback error={error} saved={saved}/>
        {!experience && !error && <p role="status">Loading languages…</p>}
        {experience && !locales.length && <p>Add another locale in Articles → Help Center settings to create translations.</p>}
        {locales.length > 0 && <div className="form-group"><label className="form-label" htmlFor="translation-locale">Translation locale</label><select id="translation-locale" className="form-select" value={locale} disabled={busy} onChange={event => {
            if (dirty && !window.confirm('Discard unsaved translation changes?')) return;
            markSaved(); setDirtyState(false); setLocale(event.target.value);
        }}><option value="">Choose a locale</option>{locales.map(value => <option key={value} value={value}>{value}</option>)}</select></div>}
        {locale && !draft && !error && <p role="status">Loading translation…</p>}
        {locale && draft && <form onSubmit={save}>
            <Field name="translation-title" label="Translated title" value={draft.title} required onChange={(_, value) => change('title', value)}/>
            <Field name="translation-summary" label="Translated summary" value={draft.summary} type="textarea" rows={3} onChange={(_, value) => change('summary', value)}/>
            <div className="form-group"><label className="form-label" htmlFor="translation-content">Translated content</label><ArticleMarkdownEditor key={`${locale}-${revision}`} inputId="translation-content" initialMarkdown={draft.content || ''} required onMarkdownChange={value => change('content', value)}/></div>
            <Field name="translation-review" label="Editorial review" value={draft.reviewStatus || 'draft'} onChange={(_, value) => change('reviewStatus', value)} options={[{value: 'draft', label: 'Draft — needs review'}, {value: 'reviewed', label: 'Reviewed — ready for readers'}]}/>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save translation'}</button>
        </form>}
    </section>;
}
