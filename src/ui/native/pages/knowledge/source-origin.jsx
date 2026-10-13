import React from 'react';

// A knowledge source the app can crawl again is one it has crawled (it kept its crawl input), or one still waiting for
// its first crawl: an added website address with no content yet. A source that already holds published content but never
// had a crawl input did not come from a crawl: it was written with the workspace (the one-off read of its website, or
// the demo inbox). There is nothing for the crawl route to repeat, so no view offers it. A source that has a crawl input
// is never judged here, so a crawl that cannot run, for example without Apify, keeps showing its own error.
export const canCrawl = source => Boolean(source?.source_input) || (Boolean(source?.url) && !source?.published_version);

export const originLine = source => source?.url
    ? 'Read from your website when this workspace was created.'
    : 'Provided with this workspace. There is no website to read it from.';

export function SourceOrigin({ source }) {
    return <p className="knowledge-source-origin" data-testid="source-origin">{originLine(source)}</p>;
}
