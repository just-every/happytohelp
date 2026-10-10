import React from 'react';

export default function ArticleEditorActions({ isPublished, savedStatus, busy, unavailable = false, onPublish, onDelete, onUnpublish }) {
    const status = savedStatus || (isPublished ? 'Published' : 'Draft');

    return <div className="article-editor-actions" role="group" aria-label="Article save and publish">
        <p className="article-editor-actions__status" role="status" aria-live="polite">
            <span>Status</span>
            <strong>{status}</strong>
        </p>
        <div className="article-editor-actions__buttons knowledge-form-actions">
            {onDelete && <button className="btn btn-link text-danger" type="button" disabled={busy || unavailable} onClick={onDelete}>Delete</button>}
            {isPublished && <button className="btn btn-white" type="button" disabled={busy || unavailable} onClick={onUnpublish}>Unpublish</button>}
            <button className="btn btn-white" type="submit" disabled={busy || unavailable}>
                {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-primary" type="button" disabled={busy || unavailable} onClick={onPublish}>
                {busy ? 'Publishing…' : 'Publish'}
            </button>
        </div>
    </div>;
}
