import {CRAWL_DEPTH, CRAWL_PAGES, crawlDepthError, crawlPagesError} from '../../../../modules/knowledge/crawl-limits';

export const datasetLimitHints = {
    max_crawl_depth: `How many links deep to follow from the starting URL, from ${CRAWL_DEPTH.min} to ${CRAWL_DEPTH.max}.`,
    max_crawl_pages: `The most pages to read from this website, from ${CRAWL_PAGES.min} to ${CRAWL_PAGES.max.toLocaleString('en-US')}.`,
};

/** Field-level problems of a dataset draft keyed by field name, or null when it can be saved. */
export function validateDataset(draft) {
    const errors = {};
    const text = String(draft.url ?? '').trim();
    if (!text) errors.url = 'Starting URL is required.';
    else {
        let parsed;
        try { parsed = new URL(text); } catch { parsed = null; }
        if (!parsed || !['https:', 'http:'].includes(parsed.protocol)) errors.url = 'Enter a full website address starting with https:// or http://.';
    }
    const depth = crawlDepthError(draft.max_crawl_depth, true), pages = crawlPagesError(draft.max_crawl_pages, true);
    if (depth) errors.max_crawl_depth = depth;
    if (pages) errors.max_crawl_pages = pages;
    return Object.keys(errors).length ? errors : null;
}
