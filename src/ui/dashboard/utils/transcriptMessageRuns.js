// Called within an actor group. Activity stays between message runs so only
// consecutive messages share a colored card, preserving transcript order.
function transcriptMessageRuns(items) {
    const rows = [];
    for (const item of items) {
        if (Array.isArray(item) || item.type) {
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
