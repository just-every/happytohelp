import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../../transport';
import { useConfirmation } from '../ConfirmDialog';

export default function ArticleHistory({ projectId, article, onRollback }) {
    const [history, setHistory] = useState(null);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');
    const { ask, dialog } = useConfirmation();
    const path = `/api/knowledge/${projectId}/articles/${article.id}`;
    const load = async () => setHistory(await nativeRequest(path + '/history'));
    useEffect(() => { let active = true; nativeRequest(path + '/history').then(value => { if (active) setHistory(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [path, article.updated_at]);
    const restore = version => ask({
        title: 'Restore this article version?', confirmLabel: 'Restore version', busyLabel: 'Restoring…',
        body: <p>This restores “{version.snapshot.title}”, its URL slug, content and publication status. Unsaved article changes will be replaced. The current version stays in history and old URLs continue to redirect.</p>,
        run: async () => {
            await nativeRequest(path + '/rollback', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({versionId: version.id})});
            await onRollback(); await load(); setSelected(null);
        },
    });
    return <section className="knowledge-governance-group">
        <h2>Version history</h2>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!history && !error && <p role="status">Loading versions…</p>}
        {history && <>
            <p className="settings-note">Each saved version is kept so an editor can review and restore earlier content.</p>
            {!history.versions.length ? <p>No earlier versions yet. Save an article update to create a version.</p> : <div className="table-responsive"><table className="table knowledge-table stack-table"><thead><tr><th>Saved</th><th>Article</th><th>Status</th><th>Actions</th></tr></thead><tbody>{history.versions.map(version => <tr key={version.id}>
                <td data-label="Saved">{new Date(version.created_at).toLocaleString()}</td>
                <td data-label="Article">{version.snapshot.title}<small>{version.snapshot.slug}</small></td>
                <td data-label="Status">{version.snapshot.status === 'published' ? 'Published' : 'Draft'}</td>
                <td data-label="Actions"><div className="knowledge-inline-actions"><button type="button" className="btn btn-white" onClick={() => setSelected(version)}>Review</button><button type="button" className="btn btn-link" onClick={() => restore(version)}>Restore</button></div></td>
            </tr>)}</tbody></table></div>}
            {selected && <section className="knowledge-version-preview" aria-label="Selected version"><h3>{selected.snapshot.title}</h3><p>{selected.snapshot.summary}</p><pre>{selected.snapshot.content}</pre><button type="button" className="btn btn-link" onClick={() => setSelected(null)}>Close version preview</button></section>}
            <h3 className="mt-4">Old article URLs</h3>
            {!history.redirects.length ? <p>No redirects yet. A redirect is created when you change the article URL slug.</p> : <ul className="knowledge-redirects">{history.redirects.map(redirect => <li key={redirect.slug}><a href={`/help/${projectId}/${encodeURIComponent(redirect.slug)}`} target="_blank" rel="noreferrer">{redirect.slug}</a><span> → {article.slug}</span></li>)}</ul>}
        </>}
        {dialog}
    </section>;
}
