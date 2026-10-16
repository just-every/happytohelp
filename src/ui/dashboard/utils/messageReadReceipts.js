/** The server sends only committed first-read times. The same receipt can arrive
 * over both sockets and the command response; applying it is idempotent. */
export function mergeMessageReadReceipts(buckets, receipts) {
    const byMessage = new Map();
    for (const receipt of receipts || []) {
        if (!receipt || !receipt.messageId || !receipt.readerId || typeof receipt.readAt !== 'string'
            || !['contact', 'operator'].includes(receipt.readerRole)) continue;
        const field = receipt.readerRole === 'contact' ? 'read_by_contacts' : 'read_by_agents';
        if (!byMessage.has(receipt.messageId)) byMessage.set(receipt.messageId, []);
        byMessage.get(receipt.messageId).push({field, readerId: receipt.readerId, readAt: receipt.readAt});
    }
    let changed = false;
    const result = buckets.map(bucket => {
        let bucketChanged = false;
        const messages = (bucket.messages || []).map(message => {
            let next = message;
            for (const {field, readerId, readAt} of byMessage.get(message.id) || []) {
                if (next[field]?.[readerId] === readAt) continue;
                next = {...next, [field]: {...next[field], [readerId]: readAt}};
            }
            bucketChanged ||= next !== message;
            return next;
        });
        changed ||= bucketChanged;
        return bucketChanged ? {...bucket, messages} : bucket;
    });
    return changed ? result : buckets;
}
