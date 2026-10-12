import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {prepareNativeLocal} from '../../scripts/installer/native-local.mjs';
import {validateRuntimeEnvironment} from '../../scripts/deployment/environment.mjs';

test('native local preparation selects capture and refuses to replace a saved remote provider',async()=>{
 const root=await mkdtemp(join(tmpdir(),'h2h-local-mail-'));
 try{
  const path=join(root,'.dev.vars');
  await writeFile(path,'OWNER_SETTING="retained"\n',{mode:0o600});
  const context={root,input:{EMAIL_PROVIDER:'later'}};await prepareNativeLocal(context);
  assert.equal(context.input.EMAIL_PROVIDER,'development');
  const remoteKey=randomBytes(24).toString('hex');const retained='EMAIL_PROVIDER="sendgrid"\nEMAIL_API_KEY="'+remoteKey+'"\nOWNER_SETTING="retained"\n';await writeFile(path,retained,{mode:0o600});
  await assert.rejects(prepareNativeLocal({root,input:{EMAIL_PROVIDER:'later'}}),/saved mail provider/);
  assert.equal(await readFile(path,'utf8'),retained,'native adapter refuses a remote selection without replacing it');
  assert.throws(()=>validateRuntimeEnvironment({H2H_LOCAL:'true',EMAIL_PROVIDER:'development'}),/cannot be deployed/);
  assert.throws(()=>validateRuntimeEnvironment({EMAIL_PROVIDER:'development'}),/must be resend/);
 }finally{await rm(root,{recursive:true,force:true});}
});
