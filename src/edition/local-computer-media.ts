import { id, requireValue, type LocalEnv } from '../modules/local-computer/contracts';

export type LocalAttachment = { id: string; storage_key: string; filename: string; mime_type: string; size: number };
type Scope = { projectId: string; conversationId: string; operatorId: string; requestId: string };
export type MediaGuard = { sql: string; args: unknown[] };

/** The native local-result conversion, shared by automatic delivery and editable drafts.
 * R2 copies precede the atomic D1 batch. Each attempt owns its staging keys, so
 * a losing concurrent adoption can clean up without deleting the winner's bytes. */
export async function copyLocalAttachments(env: LocalEnv, scope: Scope, attachments: LocalAttachment[], guard?: MediaGuard) {
    const staged: string[] = [], inserts: D1PreparedStatement[] = [];
    const mediaIds = attachments.map(attachment => scope.requestId + ':' + attachment.id);
    const rows = async () => Promise.all(mediaIds.map(mediaId => env.DB.prepare('SELECT * FROM media WHERE id=?').bind(mediaId).first<any>()));
    const validate = (row: any, attachment: LocalAttachment) => {
        requireValue(row && row.project_id === scope.projectId && row.conversation_id === scope.conversationId
            && row.uploaded_by === scope.operatorId && row.filename === attachment.filename
            && row.content_type === attachment.mime_type && row.size === attachment.size
            && (!guard || row.message_id === null), 'Attachment is not available for this draft', 409);
    };
    try {
        const existing = await rows();
        for (const [index, attachment] of attachments.entries()) {
            if (existing[index]) {
                validate(existing[index], attachment);
                const stored = await env.FILES.head(existing[index].object_key);
                requireValue(stored && stored.size === attachment.size, 'Attachment copy missing or incomplete', 409);
                continue;
            }
            const source = await env.FILES.get(attachment.storage_key);
            requireValue(source && source.size === attachment.size, 'Screenshot missing or incomplete', 409);
            const bytes = await source.arrayBuffer();
            requireValue(bytes.byteLength === attachment.size, 'Screenshot incomplete', 409);
            const key = `${scope.projectId}/${scope.conversationId}/${id()}`;
            staged.push(key);
            const stored = await env.FILES.put(key, bytes, { httpMetadata: { contentType: attachment.mime_type } });
            requireValue(stored && stored.size === attachment.size, 'Screenshot copy incomplete', 409);
            inserts.push(env.DB.prepare(`INSERT INTO media(id,project_id,conversation_id,uploaded_by,object_key,filename,content_type,size,created_at)
                SELECT ?,?,?,?,?,?,?,?,? ${guard ? `WHERE EXISTS(${guard.sql})` : ''} ON CONFLICT(id) DO NOTHING`)
                .bind(mediaIds[index], scope.projectId, scope.conversationId, scope.operatorId, key,
                    attachment.filename, attachment.mime_type, attachment.size, Date.now(), ...(guard?.args || [])));
        }
        if (inserts.length) await env.DB.batch(inserts);
        if (guard) requireValue(await env.DB.prepare(guard.sql).bind(...guard.args).first(), 'Draft authority or conversation changed; review again', 409);
        const adopted = await rows();
        for (const [index, row] of adopted.entries()) validate(row, attachments[index]);
        return adopted.map(row => ({ id: row.id, filename: row.filename, filename_original: row.filename,
            size: row.size, aggregate_type: row.content_type.startsWith('image/') ? 'image' : 'file',
            url: `/api/conversations/${scope.conversationId}/media/${encodeURIComponent(row.id)}`,
            preview_url: `/api/conversations/${scope.conversationId}/media/${encodeURIComponent(row.id)}` }));
    } finally {
        // On a lost D1 response, committed rows retain their objects. Only this
        // attempt's unreferenced copies can be deleted, never the local originals.
        for (const key of staged) {
            if (!await env.DB.prepare('SELECT id FROM media WHERE object_key=?').bind(key).first()) await env.FILES.delete(key);
        }
    }
}
