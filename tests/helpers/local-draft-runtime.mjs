import {migrationStatements} from './migration-statements.mjs';
import assert from 'node:assert/strict';
import {readFile, readdir, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {build} from 'esbuild';

export const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=', 'base64');
export async function localDraftRuntime() {
    const packages = await readdir('node_modules/.pnpm');
    const {Miniflare, convertV4MiniflareOptions} = await import('../../node_modules/.pnpm/' + packages.find(x => x.startsWith('miniflare@')) + '/node_modules/miniflare/dist/src/index.js');
    const folder = await mkdtemp(join(tmpdir(), 'h2h-local-draft-'));
    let mf;
    try {
        await build({entryPoints:['tests/helpers/local-draft-worker.ts'], outfile:join(folder,'worker.mjs'), bundle:true,
            format:'esm', platform:'neutral', external:['node:crypto','node:buffer','cloudflare:workers'], logLevel:'silent'});
        mf = new Miniflare(convertV4MiniflareOptions({modules:true, script:await readFile(join(folder,'worker.mjs'),'utf8'),
            compatibilityDate:'2026-09-01', compatibilityFlags:['nodejs_compat'], d1Databases:['DB'], r2Buckets:['FILES'],
            durableObjects:{CONVERSATIONS:{className:'ConversationSocket',useSQLite:true}}}));
        const db = await mf.getD1Database('DB'), bucket = await mf.getR2Bucket('FILES');
        for (const file of ['0001_identity.sql','0002_conversations.sql','123_operator_notifications.sql','0004_message_intent.sql','0005_widget_identity.sql',
            '030_local_computer.sql','0070_management.sql','0050_knowledge.sql','0060_customer_context.sql','0060_customer_context_engine.sql','0080_integrations.sql','020_ai_support.sql','112_conversation_outcomes.sql']) {
            for (const statement of migrationStatements(await readFile('migrations/'+file,'utf8'))) await db.prepare(statement).run();
        }
        const request = async (path, body, token, headers = {}, method = body === undefined ? 'GET' : 'POST') => {
            const response = await mf.dispatchFetch('http://localhost'+path, {method, headers:{'Content-Type':'application/json',
                ...(token ? {Authorization:'Bearer '+token} : {}), ...headers}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
            return {status:response.status, body:await response.json()};
        };
        const fixture = async ({count = 1, verified = true, mode = 'resolve', legacyOnly = false} = {}) => {
            const projectId = randomUUID(), userId = randomUUID(), conversationId = randomUUID(), contactId = randomUUID(), token = randomUUID();
            await db.batch([
                db.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,1)').bind(projectId,'Draft test',randomUUID(),'http://localhost'),
                db.prepare('INSERT INTO users VALUES(?,?,?,1)').bind(userId,userId+'@example.test','Owner'),
                db.prepare('INSERT INTO memberships VALUES(?,?,?)').bind(projectId,userId,'owner'),
                db.prepare('INSERT INTO contacts(id,project_id,name,created_at) VALUES(?,?,?,1)').bind(contactId,projectId,'Customer'),
                db.prepare('INSERT INTO conversations(id,project_id,contact_id,created_at,updated_at) VALUES(?,?,?,1,1)').bind(conversationId,projectId,contactId),
                db.prepare('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)').bind(createHash('sha256').update(token).digest('hex'),userId,projectId,'owner',Date.now()+3600000),
            ]);
            const post = async (path, body, auth = token) => {
                const response = await request(path,body,auth);
                assert.equal(response.status,200,JSON.stringify(response.body));
                return response.body.data;
            };
            const pairing = await post(`/api/projects/${projectId}/local-agents/pairings`,{});
            const paired = await post('/api/local-agents/pair',{code:pairing.code,name:'Native draft fixture',provider:'codex',capabilities:[]});
            const base = `/api/projects/${projectId}/conversations/${conversationId}/delegations`;
            const job = await post(base,{request_id:randomUUID(),device_id:paired.device.id,mode,instructions:'Test fixture, no model execution.'});
            const claim = await post('/api/local-agents/claim',{claim_id:randomUUID()},paired.token);
            assert.equal(claim.id,job.id);
            const localAttachmentIds = [];
            for (let index=0;index<count;index++) {
                const form = new FormData();
                form.set('run_id',claim.run_id);
                form.set('file',new File([png],`shot-${index}.png`,{type:'image/png'}));
                const encoded = new Request('http://localhost',{method:'POST',body:form});
                const upload = await mf.dispatchFetch(`http://localhost/api/local-agents/jobs/${job.id}/attachments`,{
                    method:'POST',headers:{Authorization:'Bearer '+paired.token,'Content-Type':encoded.headers.get('Content-Type')},body:await encoded.arrayBuffer()});
                assert.equal(upload.status,200,await upload.clone().text());
                localAttachmentIds.push((await upload.json()).data.id);
            }
            const result = {summary:'Completed native upload fixture',actions:[],verified,reply_draft:'Legacy editable body',
                attachment_ids:localAttachmentIds,replies:[{id:'selected',title:'Reply',body:'Editable proposal body',attachment_ids:localAttachmentIds}],follow_up_actions:[]};
            if (legacyOnly) delete result.replies;
            await post(`/api/local-agents/jobs/${job.id}/result`,{run_id:claim.run_id,event_id:randomUUID(),status:'completed',result},paired.token);
            const draftPath = base+'/'+job.id+'/result/draft';
            const command = {proposal_id:'selected',expected_revision:0,expected_last_message_id:null};
            const adopt = (data = {}, headers = {}) => request(draftPath,{...command,...data},token,headers);
            const media = async () => (await db.prepare('SELECT * FROM media WHERE conversation_id=? ORDER BY id').bind(conversationId).all()).results;
            const messages = async () => (await db.prepare('SELECT * FROM messages WHERE conversation_id=?').bind(conversationId).all()).results;
            return {projectId,userId,conversationId,token,deviceId:paired.device.id,deviceToken:paired.token,jobId:job.id,result,
                localAttachmentIds,draftPath,command,adopt,media,messages};
        };
        return {db,bucket,mf,request,fixture,async close(){await mf.dispose();await rm(folder,{recursive:true,force:true});}};
    } catch (error) { await mf?.dispose(); await rm(folder,{recursive:true,force:true}); throw error; }
}
