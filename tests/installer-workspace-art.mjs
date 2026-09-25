import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWorkspaceArt,validatePng,workspaceContext} from '../scripts/installer/workspace-art.mjs';
const root=await mkdtemp(join(tmpdir(),'workspace-art-'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1cAAAAASUVORK5CYII=','base64');
const state={sessionId:'session',agent:{attached:false},draft:{}};const store={state};
try{
 assert.deepEqual(workspaceContext({allowedOrigin:'https://example.test/',name:' Example ',primaryColor:'#1286AB'}),{website:'https://example.test',name:'Example',primaryColor:'#1286ab'});
 const delivered=[],jobs=await createWorkspaceArt(root,store,{onSidebar:async item=>delivered.push(item)});
 assert.equal(await jobs.request(),null);state.agent.attached=true;assert.equal(await jobs.request(),null);
 state.draft={allowedOrigin:'https://example.test',name:'Example',primaryColor:'#1286ab'};
 const job=await jobs.request(),fence={id:job.id,revision:job.revision,sessionId:state.sessionId};assert.equal((await jobs.request()).id,job.id);
 await assert.rejects(jobs.report({...fence,phase:'generating'}),/actual website/);
 const siteBrief={website:job.context.website,sourceUrl:'https://example.test/about',summary:'Customer support software.',subjects:['Support conversations']};
 await jobs.report({...fence,phase:'generating',siteBrief});await assert.rejects(jobs.report({...fence,phase:'generating',siteBrief}),/already been claimed/);
 await assert.rejects(jobs.complete({...fence,sessionId:'stale'},png),/changed/);
 await assert.rejects(jobs.complete({...fence,kind:'background'},png),/Only sidebar/);
 const opaque=Buffer.from(png);opaque[25]=2;assert.throws(()=>validatePng(opaque),/alpha/);
 await jobs.complete(fence,png);assert.equal(job.phase,'ready');assert.equal(delivered.length,1);assert.deepEqual(delivered[0].context,job.context);
 await assert.rejects(jobs.complete(fence,png),/Claim/);assert.equal((await jobs.request()).id,job.id);
 state.draft.name='Changed';assert.equal(delivered[0].isCurrent(),false);const second=await jobs.request();assert.notEqual(second.id,job.id);
 await assert.rejects(jobs.complete(fence,png),/changed/);
 await jobs.report({id:second.id,revision:second.revision,sessionId:state.sessionId,phase:'error'});assert.equal((await jobs.request()).phase,'error');
 console.log('Workspace artwork: valid context, researched claim, typed PNG, duplicate prevention, stale workspace/session rejection and transfer context passed.');
}finally{await rm(root,{recursive:true,force:true});}
