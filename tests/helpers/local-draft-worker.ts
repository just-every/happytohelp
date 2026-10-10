import { Hono } from 'hono';
import { registerLocalComputerRoutes } from '../../src/modules/local-computer';
import { localComputerIntegration } from '../../src/edition/local-computer';
import { createConversationRoutes } from '../../src/modules/conversations/routes';
export { ConversationSocket } from '../../src/modules/conversations/socket';

// Fault injection exists only in this isolated test Worker. All successful
// operations go through the real local agent, native media and admission paths.
const app = new Hono<any>();
app.onError((error: any, c) => c.json({ message: error.message }, error.status || 500));
app.use('*', async (c, next) => {
    const fault = c.req.header('x-test-fault');
    c.env = { ...c.env };
    if (fault) {
        const DB = c.env.DB, FILES = c.env.FILES;
        let puts = 0;
        c.env.FILES = {
            get: FILES.get.bind(FILES), head: FILES.head.bind(FILES), delete: FILES.delete.bind(FILES),
            async put(...args: any[]) {
                if (fault === 'second-copy' && ++puts === 2) throw new Error('Injected R2 copy failure');
                if (fault === 'unknown-copy') { await FILES.put(...args); throw new Error('Injected lost R2 response'); }
                return FILES.put(...args);
            },
        };
        c.env.DB = {
            prepare: DB.prepare.bind(DB),
            async batch(statements: any[]) {
                if (fault === 'db-before') throw new Error('Injected D1 failure');
                if (fault === 'revoke') await DB.prepare('UPDATE local_devices SET revoked_at=?').bind('revoked-during-copy').run();
                if (fault === 'frontier') await DB.prepare('UPDATE conversations SET revision=revision+1').run();
                if (fault === 'cancel') await DB.prepare('UPDATE local_jobs SET cancel_requested=1').run();
                if (fault === 'grant') await DB.prepare("UPDATE local_grants SET revoked_at='revoked-during-copy'").run();
                if (fault === 'proposal') await DB.prepare("UPDATE local_jobs SET result=json_set(result,'$.reply_draft','changed-during-copy')").run();
                if (fault === 'attachment') await DB.prepare("UPDATE local_attachments SET device_id='foreign-during-copy'").run();
                const result = await DB.batch(statements);
                if (fault === 'db-after') throw new Error('Injected lost D1 response');
                return result;
            },
        };
    }
    await next();
});
registerLocalComputerRoutes(app, localComputerIntegration);
app.route('/api/conversations', createConversationRoutes());
export default { fetch: app.fetch };
