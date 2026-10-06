import React from 'react';

export default function ArticleEditorActions({ isPublished, savedStatus, busy, onPublish, onDelete }) {
    const status = savedStatus || (isPublished ? 'Published' : 'Draft');

    return <div className="article-editor-actions" role="group" aria-label="Article save and publish">
        <p className="article-editor-actions__status" role="status" aria-live="polite">
            <span>Status</span>
            <strong>{status}</strong>
        </p>
        <div className="article-editor-actions__buttons">
            {onDelete && <button className="btn btn-link text-danger" type="button" disabled={busy} onClick={onDelete}>Delete</button>}
            <button className="btn btn-white" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={onPublish}>
                {busy ? 'Publishing…' : 'Publish'}
            </button>
        </div>
    </div>;
}
