
import { MAX_ACTIONS, MAX_SUMMARIES } from './context.js';

const selectSummaryBatch = (summaries = [], actions = []) => ({
    summaries: summaries.slice(0, MAX_SUMMARIES),
    actions: actions.slice(0, MAX_ACTIONS),
});

const metadataForSummaryContext = (context = {}) => {
    const persist = context.summary_persist;
    return typeof persist === 'string' && persist.trim()
        ? { persist }
        : undefined;
};

export {
    selectSummaryBatch,
    metadataForSummaryContext,
};
