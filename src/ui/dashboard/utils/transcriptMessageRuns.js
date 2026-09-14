// Called within an actor group. Customer visits share their messages' card;
// notes and other activity always break a run.
function transcriptMessageRuns(items, { includePageViews = false } = {}) {
    const rows = [];
    for (const item of items) {
        const isPageView = Array.isArray(item)
            ? item.length > 0 && item.every(event => event.type === 'PAGE_VIEW')
            : item.type === 'PAGE_VIEW';
        if ((Array.isArray(item) || item.type) && !(includePageViews && isPageView)) {
            rows.push({ item });
        } else {
            const previous = rows[rows.length - 1];
            if (previous?.entries) previous.entries.push(item);
            else rows.push({ entries: [item] });
        }
    }
    return rows;
}

export default transcriptMessageRuns;
