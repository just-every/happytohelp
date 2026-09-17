import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWorkerAvailable } from '../scripts/installer/address.mjs';
import { installationCredential, installationReceipt } from '../scripts/installer/private.mjs';
const root=await mkdtemp(join(tmpdir(),'h2h-collision-'));
const input={accountId:'a'.repeat(32),prefix:'workspace',appOrigin:'https://workspace.account.workers.dev',apiToken:'test-token'};
let calls=0;const options={env:{},fetch:async(url,init)=>{calls++;assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${input.accountId}/workers/scripts/workspace/settings`);assert.equal(init.headers.Authorization,'Bearer test-token');return new Response('',{status:200})}};
try{
 await assert.rejects(assertWorkerAvailable(root,input,options),{code:'name_in_use'});
 assert.equal(await installationReceipt(root,input.appOrigin,{accountId:input.accountId,prefix:input.prefix}),null);
 await assertWorkerAvailable(root,input,{...options,fetch:async()=>new Response('',{status:404})});
 const credential=await installationCredential(root,input.appOrigin,{accountId:input.accountId,prefix:input.prefix});
 await assert.rejects(assertWorkerAvailable(root,input,options),{code:'name_in_use'});
 await credential.markDeployed();calls=0;await assertWorkerAvailable(root,input,options);assert.equal(calls,0);
 await assert.rejects(assertWorkerAvailable(root,{...input,accountId:'b'.repeat(32)},options),{code:'receipt_scope'});
 await assert.rejects(assertWorkerAvailable(root,{...input,prefix:'different'},options),{code:'receipt_scope'});
 await credential.clear();
 await installationCredential(root,input.appOrigin);const directory=join(root,'.seed/installer/private');const files=await readdir(directory);const before=await readFile(join(directory,files[0]),'utf8');
 await assert.rejects(assertWorkerAvailable(root,input,options),{code:'receipt_scope'});
 assert.equal(await readFile(join(directory,files[0]),'utf8'),before);
 console.log('Installer collision guard passed: existing name denied, absence verified, deployed receipt scoped to account/name/origin, old receipt preserved.');
}finally{await rm(root,{recursive:true,force:true})}
