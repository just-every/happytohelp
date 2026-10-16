import React from 'react';

export const datasetIsActive = source => ['ingesting', 'processing', 'crawling'].includes(source?.status);

export default function DatasetProgress({ source }) {
    const labels = {
        empty: 'Waiting for content',
        crawling: 'Crawling website…',
        ingesting: source.ingest_cursor < 0 ? 'Queued to read website…' : 'Indexing website content…',
        processing: source.ingest_cursor < 0 ? 'Preparing website content…' : 'Indexing website content…',
        ready: 'Ready for AI answers',
        failed: 'Refresh failed',
    };
    return <div role="status" aria-live="polite">
        <span>{labels[source.status] || source.status}</span>
        {datasetIsActive(source) && <p className="settings-note">Progress updates automatically. {source.published_version ? 'The last published content remains available for AI answers.' : 'Content becomes available for AI answers when indexing finishes.'}</p>}
        {source.status === 'failed' && source.published_version && <p className="settings-note">The last published content is still available for AI answers.</p>}
    </div>;
}
