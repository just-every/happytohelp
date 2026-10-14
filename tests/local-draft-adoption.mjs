import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {randomUUID, createHash} from 'node:crypto';
import {localDraftRuntime, png} from './helpers/local-draft-runtime.mjs';

let runtime;
before(async()=>{ runtime = await localDraftRuntime(); });
after(async()=>{ await runtime?.close(); });
const run = (sql,...args) => runtime.db.prepare(sql).bind(...args).run();
const one = (sql,...args) => runtime.db.prepare(sql).bind(...args).first();
const keys = async f => (await runtime.bucket.list()).objects.filter(o => o.key.startsWith(f.projectId+'/')).map(o=>o.key).sort();
const noAdoption = async f => { assert.deepEqual(await f.media(),[]); assert.deepEqual(await f.messages(),[]); assert.deepEqual(await keys(f),[]); };

test('Local and legacy Use adopt exact native owned media, deduplicate, then ordinary Send admits exactly once',async()=>{
    const f = await runtime.fixture();
    const [first, concurrent] = await Promise.all([f.adopt(),f.adopt()]);
    assert.equal(first.status,200,JSON.stringify(first));
    assert.equal(concurrent.status,200,JSON.stringify(concurrent));
    assert.deepEqual(first.body.data,concurrent.body.data);
    const mediaId = first.body.data.attachments[0].id;
    assert.notEqual(mediaId,f.localAttachmentIds[0],'local evidence and native media are separate identities');
    const legacy = await f.adopt({proposal_id:null});
    assert.equal(legacy.status,200,JSON.stringify(legacy));
    assert.equal(legacy.body.data.body,f.result.reply_draft);
    assert.equal(legacy.body.data.attachments[0].id,mediaId);
    assert.deepEqual(await f.messages(),[],'Use never sends');
    const rows = await f.media();
    assert.equal(rows.length,1);assert.equal(rows[0].uploaded_by,f.userId);assert.equal(rows[0].project_id,f.projectId);
    assert.equal(rows[0].conversation_id,f.conversationId);assert.equal(rows[0].message_id,null);
    assert.equal((await keys(f)).length,1,'losing concurrent copy leaves no orphan');
    assert.deepEqual(Buffer.from(await (await runtime.bucket.get(rows[0].object_key)).arrayBuffer()),png);
    const local = await one('SELECT * FROM local_attachments WHERE id=?',f.localAttachmentIds[0]);
    assert.deepEqual(Buffer.from(await (await runtime.bucket.get(local.storage_key)).arrayBuffer()),png,'source bytes retained');
    const edited = 'Operator edit '+randomUUID();
    const command = {localId:randomUUID(),content:edited,expectedRevision:0,expectedLastMessageId:null,mediaIds:[mediaId]};
    const path = `/api/conversations/${f.conversationId}/messages`;
    const sent = await runtime.request(path,command,f.token);
    assert.equal(sent.status,200,JSON.stringify(sent));assert.equal(sent.body.accepted,true);
    const replay = await runtime.request(path,command,f.token);
    assert.equal(replay.body.duplicate,true);assert.equal(replay.body.message.id,sent.body.message.id);
    assert.equal((await f.messages()).length,1);assert.equal((await f.messages())[0].content,edited);
    assert.equal((await f.media())[0].message_id,sent.body.message.id);
    const transcript = await runtime.request(path,undefined,f.token);
    assert.equal(transcript.body.messages[0].media[0].id,mediaId);
    const download = await runtime.mf.dispatchFetch('http://localhost'+first.body.data.attachments[0].url,{headers:{Authorization:'Bearer '+f.token}});
    assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),png);
    assert.equal((await f.adopt({expected_revision:1,expected_last_message_id:sent.body.message.id})).status,409,'sent media cannot silently become another draft');
});

test('body-only draft validates authority and never creates a message or media',async()=>{
    const f=await runtime.fixture({count:0});
    assert.equal((await f.adopt()).status,200);await noAdoption(f);
    await run('UPDATE local_devices SET revoked_at=? WHERE id=?','revoked',f.deviceId);
    assert.equal((await f.adopt()).status,409);await noAdoption(f);
});

test('unverified fixes need input and cannot become drafts; investigation reports remain editable without automatic send',async()=>{
    for(const mode of ['resolve','resolve_reply','investigate']) {
        const f=await runtime.fixture({verified:false,mode});
        const listed=await runtime.request(`/api/projects/${f.projectId}/conversations/${f.conversationId}/delegations`,undefined,f.token);
        assert.equal(listed.status,200);
        const job=listed.body.data.find(job=>job.id===f.jobId);
        assert.equal(job.result.verified,false);
        if(mode==='investigate') {
            assert.equal(job.status,'completed');
            assert.equal((await f.adopt()).status,200);
            assert.equal((await f.media()).length,1);
            assert.deepEqual(await f.messages(),[]);
        } else {
            assert.equal(job.status,'needs_input','a reported fix cannot complete without verification');
            assert.equal((await f.adopt()).status,409);
            assert.equal((await f.adopt({proposal_id:null})).status,409,'legacy draft cannot bypass unverified-fix review');
            await noAdoption(f);
        }
        assert.equal((await runtime.request(f.draftPath.replace('/draft','/replies/selected/send'),{},f.token)).status,409);
        assert.deepEqual(await f.messages(),[]);
    }
});

test('actor, tenant, conversation, device and job selection cannot adopt another result',async()=>{
    const f=await runtime.fixture(),other=await runtime.fixture();
    assert.equal((await runtime.request(f.draftPath,f.command)).status,401);
    assert.equal((await runtime.request(f.draftPath,f.command,f.deviceToken)).status,401);
    assert.equal((await runtime.request(f.draftPath,f.command,other.token)).status,403);
    await run('INSERT INTO memberships VALUES(?,?,?)',f.projectId,other.userId,'operator');
    const peerToken=randomUUID();
    await run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',createHash('sha256').update(peerToken).digest('hex'),other.userId,f.projectId,'operator',Date.now()+3600000);
    assert.equal((await runtime.request(f.draftPath,f.command,peerToken)).status,409,'same-project peer does not own this job');
    assert.equal((await runtime.request(f.draftPath.replace(f.conversationId,other.conversationId),f.command,f.token)).status,409);
    assert.equal((await runtime.request(f.draftPath.replace(f.jobId,other.jobId),f.command,f.token)).status,409);
    assert.equal((await runtime.request(f.draftPath.replace(f.projectId,other.projectId),f.command,f.token)).status,403);
    await run('UPDATE local_devices SET user_id=? WHERE id=?',other.userId,f.deviceId);
    assert.equal((await f.adopt()).status,409);await noAdoption(f);
});

test('proposal selection, immutable frontier and required request fields are checked',async()=>{
    const f=await runtime.fixture();
    for(const change of [{proposal_id:'missing'},{expected_revision:1},{expected_last_message_id:'foreign'}]) {
        const response=await f.adopt(change);assert.ok([404,409].includes(response.status),JSON.stringify(response));
    }
    for(const change of [{proposal_id:42},{expected_revision:-1},{expected_revision:undefined},{expected_last_message_id:undefined}]) {
        assert.equal((await f.adopt(change)).status,422);
    }
    await noAdoption(f);
});

test('revocation, membership, deleted project, cancelled/incomplete job and delivery receipts deny adoption',async()=>{
    const f=await runtime.fixture();
    for(const [change,args,restore,restoreArgs] of [
        ['UPDATE local_devices SET revoked_at=? WHERE id=?',['revoked',f.deviceId],'UPDATE local_devices SET revoked_at=NULL WHERE id=?',[f.deviceId]],
        ['UPDATE local_devices SET project_id=? WHERE id=?',['foreign',f.deviceId],'UPDATE local_devices SET project_id=? WHERE id=?',[f.projectId,f.deviceId]],
        ['UPDATE local_jobs SET cancel_requested=1 WHERE id=?',[f.jobId],'UPDATE local_jobs SET cancel_requested=0 WHERE id=?',[f.jobId]],
        ...['queued','running','needs_input','failed','cancelled','revoked'].map(status=>['UPDATE local_jobs SET status=? WHERE id=?',[status,f.jobId],"UPDATE local_jobs SET status='completed' WHERE id=?",[f.jobId]]),
        ['DELETE FROM memberships WHERE project_id=? AND user_id=?',[f.projectId,f.userId],'INSERT INTO memberships VALUES(?,?,?)',[f.projectId,f.userId,'owner']],
        ['INSERT INTO project_settings VALUES(?,?,1)',[f.projectId,'{"deleted_at":1}'],'DELETE FROM project_settings WHERE project_id=?',[f.projectId]],
    ]) {
        await run(change,...args);assert.ok([401,409].includes((await f.adopt()).status));await noAdoption(f);await run(restore,...restoreArgs);
    }
    for(const status of ['sending','sent','uncertain']) {
        await run("INSERT INTO local_receipts(job_id,proposal_id,kind,status) VALUES(?,'selected','reply',?)",f.jobId,status);
        assert.equal((await f.adopt()).status,409);await noAdoption(f);
        await run('DELETE FROM local_receipts WHERE job_id=?',f.jobId);
    }
    const grant=randomUUID();
    await run('INSERT INTO local_grants(id,user_id,project_id,revoked_at) VALUES(?,?,?,?)',grant,f.userId,f.projectId,'revoked');
    await run('UPDATE local_devices SET grant_id=? WHERE id=?',grant,f.deviceId);
    assert.equal((await f.adopt()).status,409);await noAdoption(f);
});

test('unknown, foreign job, foreign device and foreign conversation uploads are refused',async()=>{
    const f=await runtime.fixture(),foreign=await runtime.fixture();
    const replace=async ids=>run('UPDATE local_jobs SET result=? WHERE id=?',JSON.stringify({...f.result,replies:[{...f.result.replies[0],attachment_ids:ids}]}),f.jobId);
    for(const ids of [[randomUUID()],[foreign.localAttachmentIds[0]]]) {
        await replace(ids);assert.equal((await f.adopt()).status,409);await noAdoption(f);
    }
    await replace(f.localAttachmentIds);
    await run('UPDATE local_attachments SET device_id=? WHERE id=?',foreign.deviceId,f.localAttachmentIds[0]);
    assert.equal((await f.adopt()).status,409);await noAdoption(f);
    await run('UPDATE local_attachments SET device_id=?,job_id=? WHERE id=?',f.deviceId,foreign.jobId,f.localAttachmentIds[0]);
    assert.equal((await f.adopt()).status,409);await noAdoption(f);
});

test('missing or truncated source R2 objects create neither native rows nor orphan copies',async()=>{
    for(const missing of [true,false]) {
        const f=await runtime.fixture({count:2});
        const source=await one('SELECT * FROM local_attachments WHERE id=?',f.localAttachmentIds[1]);
        if(missing)await runtime.bucket.delete(source.storage_key);else await runtime.bucket.put(source.storage_key,png.subarray(0,20));
        assert.equal((await f.adopt()).status,409);await noAdoption(f);
    }
});

test('a same-conversation follow-up can use only its explicitly granted parent upload',async()=>{
    const f=await runtime.fixture();
    const result={...f.result,follow_up_actions:[{id:'follow',title:'Follow up',mode:'resolve',instructions:'Test follow up',attachment_ids:f.localAttachmentIds}]};
    await run('UPDATE local_jobs SET result=? WHERE id=?',JSON.stringify(result),f.jobId);
    const follow=await runtime.request(f.draftPath.replace('/draft','/follow-up-actions/follow'),{},f.token);
    assert.equal(follow.status,200,JSON.stringify(follow));
    const childId=follow.body.data.child_delegation_id;
    const claim=await runtime.request('/api/local-agents/claim',{claim_id:randomUUID()},f.deviceToken);
    assert.equal(claim.body.data.id,childId);
    const submitted=await runtime.request(`/api/local-agents/jobs/${childId}/result`,{
        run_id:claim.body.data.run_id,event_id:randomUUID(),status:'completed',result:f.result},f.deviceToken);
    assert.equal(submitted.status,200,JSON.stringify(submitted));
    const path=f.draftPath.replace(f.jobId,childId);
    await run('DELETE FROM local_attachment_grants WHERE job_id=?',childId);
    assert.equal((await runtime.request(path,f.command,f.token)).status,409);await noAdoption(f);
    await run('INSERT INTO local_attachment_grants VALUES(?,?,?)',f.localAttachmentIds[0],childId,f.deviceId);
    const adopted=await runtime.request(path,f.command,f.token);
    assert.equal(adopted.status,200,JSON.stringify(adopted));
    assert.equal((await f.media()).length,1);assert.deepEqual(await f.messages(),[]);
    assert.deepEqual(Buffer.from(await(await runtime.bucket.get((await f.media())[0].object_key)).arrayBuffer()),png);
});

for(const fault of ['second-copy','unknown-copy','db-before','revoke','frontier','cancel','grant','proposal','attachment']) {
    test(fault+' during conversion does not admit rows/messages or leave staging objects',async()=>{
        const f=await runtime.fixture({count:2});
        if(fault==='grant') {
            const grant=randomUUID();
            await run('INSERT INTO local_grants(id,user_id,project_id) VALUES(?,?,?)',grant,f.userId,f.projectId);
            await run('UPDATE local_devices SET grant_id=? WHERE id=?',grant,f.deviceId);
        }
        const result=await f.adopt({}, {'x-test-fault':fault});
        assert.equal(result.status,['second-copy','unknown-copy','db-before'].includes(fault)?500:409,JSON.stringify(result));
        await noAdoption(f);
    });
}

test('lost D1 acknowledgment keeps committed native bytes, returns failure, and explicit Use recovers the same ids',async()=>{
    const f=await runtime.fixture({count:2});
    assert.equal((await f.adopt({}, {'x-test-fault':'db-after'})).status,500);
    const before=await f.media();assert.equal(before.length,2);assert.deepEqual(await f.messages(),[]);
    for(const row of before)assert.deepEqual(Buffer.from(await(await runtime.bucket.get(row.object_key)).arrayBuffer()),png);
    const recovered=await f.adopt();assert.equal(recovered.status,200,JSON.stringify(recovered));
    assert.deepEqual(recovered.body.data.attachments.map(a=>a.id).sort(),before.map(a=>a.id).sort());
    assert.equal((await keys(f)).length,2);
});

test('missing adopted bytes and forged ownership are not repaired or silently sent',async()=>{
    const f=await runtime.fixture();assert.equal((await f.adopt()).status,200);
    const [media]=await f.media();await runtime.bucket.delete(media.object_key);
    assert.equal((await f.adopt()).status,409);assert.deepEqual(await f.messages(),[]);
    const other=await runtime.fixture();assert.equal((await other.adopt()).status,200);
    await run('UPDATE media SET uploaded_by=? WHERE conversation_id=?',f.userId,other.conversationId);
    assert.equal((await other.adopt()).status,409);assert.deepEqual(await other.messages(),[]);
});

test('automatic legacy delivery reuses the native conversion with exact attachment bytes',async()=>{
    const f=await runtime.fixture({mode:'resolve_reply',legacyOnly:true});
    assert.equal((await one("SELECT status FROM local_receipts WHERE job_id=? AND proposal_id='legacy'",f.jobId)).status,'sent');
    const rows=await f.media();assert.equal(rows.length,1);assert.equal(rows[0].uploaded_by,f.userId);
    assert.equal((await f.messages()).length,1);
    assert.deepEqual(Buffer.from(await(await runtime.bucket.get(rows[0].object_key)).arrayBuffer()),png);
});
