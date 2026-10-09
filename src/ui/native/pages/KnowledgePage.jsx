import { useUnsavedChanges } from '../NavigationGuard';
import { useNavigate } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../transport';
import { Feedback } from './forms';
import { useConfirmation } from './ConfirmDialog';
import { deleteCopy } from './delete-copy';
import { validateDataset } from './knowledge/dataset-validation';
import ArticleEditorActions from './knowledge/ArticleEditorActions';
import KnowledgeLists from './knowledge/KnowledgeLists';
import { KnowledgeFields } from './knowledge/KnowledgeForms';
import KnowledgeTabs from './knowledge/KnowledgeTabs';
import './knowledge/knowledge.css';
import './stack-table.css';

const normalize = row => ({
    ...row,
    is_published: Boolean(row.is_published),
    refreshMode: row.refresh_mode || 'adaptive',
    excluded_urls: Array.isArray(row.excluded_urls) ? row.excluded_urls.join('\n') : parseExclusions(row.excluded_urls),
    categories: Array.isArray(row.categories) ? row.categories : [],
});

function parseExclusions(value) {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed.join('\n') : String(parsed);
    } catch {
        return value || '';
    }
}

export default function KnowledgePage({ projectId, section, recordId, project }) {
    const { markDirty, markSaved } = useUnsavedChanges();
    const navigate = useNavigate();
    const { ask, dialog } = useConfirmation();
    const path = '/api/knowledge/' + projectId + '/' + section;
    const [categories, setCategories] = useState([]);
    const [pages, setPages] = useState([]);
    const [items, setItems] = useState(null);
    const [draft, setDraft] = useState(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [savedStatus, setSavedStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState('overview');
    const [fieldErrors, setFieldErrors] = useState({});

    const load = async () => {
        const response = await nativeRequest(path);
        const rows = response.data || response;
        setItems(rows);
        if (recordId && recordId !== 'create') {
            const row = rows.find(item => item.id === recordId);
            if (!row) throw new Error('This record was not found.');
            setDraft(normalize(row));
        }
    };

    useEffect(() => {
        setDraft(null);
        setItems(null);
        setError('');
        setSaved(false);
        setSavedStatus('');
        setFieldErrors({});
        load().catch(loadError => setError(loadError.message));
        if (recordId === 'create') {
            setDraft({
                status: 'draft',
                is_published: false,
                refreshMode: 'adaptive',
                url: project?.website || '',
                max_crawl_depth: 100,
                max_crawl_pages: 1000,
                categories: [],
            });
        }
    }, [path, recordId]);

    useEffect(() => {
        if (section !== 'datasets') {
            nativeRequest('/api/knowledge/' + projectId + '/categories')
                .then(setCategories)
                .catch(loadError => setError(loadError.message));
        }
        if (section === 'datasets' && recordId && recordId !== 'create') {
            nativeRequest(path + '/' + recordId + '/pages')
                .then(response => setPages(response.data || response.pages || response))
                .catch(loadError => setError(loadError.message));
        }
    }, [path, recordId]);

    const change = (key, value) => {
        markDirty();
        setSaved(false);
        setSavedStatus('');
        setDraft(current => ({ ...current, [key]: value }));
        setFieldErrors(current => {
            const { [key]: removed, ...remaining } = current;
            return remaining;
        });
    };

    const save = async (event, publication = null) => {
        event?.preventDefault();
        setError('');
        setSaved(false);
        setSavedStatus('');
        if (section === 'datasets') {
            const problems = validateDataset(draft);
            if (problems) {
                setFieldErrors(problems);
                return;
            }
        }

        setBusy(true);
        try {
            const isPublished = section === 'articles'
                ? publication ?? Boolean(draft.is_published)
                : Boolean(draft.is_published);
            const body = { ...draft, is_published: isPublished, status: isPublished ? 'published' : 'draft' };
            delete body.categoryIds;
            delete body.categoryId;
            delete body.parentId;
            if (section === 'datasets') {
                body.name = draft.name || draft.url;
                body.excluded_urls = (draft.excluded_urls || '').split('\n').map(value => value.trim()).filter(Boolean);
                delete body.refresh_mode;
            }
            if (section === 'categories') body.parent_id = draft.parent_id || null;

            const result = await nativeRequest(path + (draft.id && section !== 'articles' ? '/' + draft.id : ''), {
                method: draft.id && section !== 'articles' ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            markSaved();
            if (!draft.id) {
                await navigate({ to: '/projects/' + projectId + '/' + section + '/' + result.id, replace: true });
                return;
            }

            setSaved(true);
            setSavedStatus(section === 'articles' ? (isPublished ? 'Published' : 'Saved as draft') : '');
            await load();
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = item => {
        const copy = deleteCopy[section];
        ask({
            title: copy.title(item),
            body: <p>{copy.effect}</p>,
            run: async () => {
                await nativeRequest(path + '/' + item.id, { method: 'DELETE' });
                markSaved();
                if (recordId) await navigate({ to: '/projects/' + projectId + '/' + section });
                else await load();
            },
        });
    };

    const refresh = async () => {
        setError('');
        setBusy(true);
        try {
            await nativeRequest(path + '/' + draft.id + '/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            await load();
        } catch (refreshError) {
            setError(refreshError.message);
        } finally {
            setBusy(false);
        }
    };

    const existingDataset = section === 'datasets' && draft?.id;
    const isArticle = section === 'articles';

    return <div className="knowledge-page">
        <KnowledgeTabs projectId={projectId} activeSection={section}/>
        <Feedback error={error} saved={saved && !isArticle}/>
        {!items && !error && <p role="status">Loading…</p>}
        {!recordId && items && <KnowledgeLists {...{ section, items, projectId, categories, remove }}/>}
        {draft && <>
            {existingDataset && <>
                <h2 className="knowledge-website-title">{draft.url || draft.name}</h2>
                <ul className="nav nav-tabs mb-4">
                    {['overview', 'pages', 'settings'].map(value => <li className="nav-item" key={value}>
                        <button className={'nav-link' + (tab === value ? ' active' : '')} onClick={() => setTab(value)}>
                            {value === 'pages' ? 'Indexed pages' : value[0].toUpperCase() + value.slice(1)}
                        </button>
                    </li>)}
                </ul>
            </>}
            {existingDataset && tab === 'overview' ? <div className="knowledge-form">
                <dl>
                    <dt>Status</dt><dd>{draft.status}</dd>
                    <dt>Last refreshed</dt><dd>{draft.last_refreshed_at ? new Date(draft.last_refreshed_at).toLocaleString() : 'Not recorded'}</dd>
                    <dt>Indexed pages</dt><dd>{pages.length}</dd>
                </dl>
                {draft.error && <p role="alert" className="alert alert-danger">{draft.error}</p>}
                <button className="btn btn-primary" disabled={busy} onClick={refresh}>Refresh now</button>
            </div> : existingDataset && tab === 'pages' ? <div className="table-responsive">
                <table className="table knowledge-table stack-table">
                    <thead><tr><th>Page</th><th>Content</th></tr></thead>
                    <tbody>{pages.map(page => <tr key={page.id || page.url}>
                        <td data-label="Page"><a href={page.url}>{page.title || page.url}</a></td>
                        <td data-label="Content">{page.content?.length ?? 0} characters</td>
                    </tr>)}</tbody>
                </table>
                {!pages.length && <p>No indexed pages yet.</p>}
            </div> : <form
                className={'knowledge-form' + (isArticle ? ' knowledge-form-wide' : '')}
                onSubmit={event => save(event)}
                noValidate={section === 'datasets'}
            >
                {isArticle && <ArticleEditorActions
                    isPublished={Boolean(draft.is_published)}
                    savedStatus={savedStatus}
                    busy={busy}
                    onPublish={event => save(event, true)}
                    onUnpublish={event => save(event, false)}
                    onDelete={draft.id ? () => remove(draft) : undefined}
                />}
                <KnowledgeFields {...{ section, draft, change, categories, fieldErrors }}/>
                {!isArticle && <div className="knowledge-form-actions">
                    <button className="btn btn-primary" disabled={busy}>
                        {busy ? 'Saving…' : draft.id ? 'Save' : section === 'datasets' ? 'Add URL' : 'Create'}
                    </button>
                    {draft.id && <button type="button" className="btn btn-link text-danger" disabled={busy} onClick={() => remove(draft)}>Delete</button>}
                </div>}
            </form>}
        </>}
        {dialog}
    </div>;
}
