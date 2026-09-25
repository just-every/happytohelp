import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join}from'node:path';
import {legacyWranglerCredentials,wranglerCredentials,assertProductionCloudflare}from'../scripts/installer/wrangler-auth.mjs';
const home=await mkdtemp(join(tmpdir(),'h2h-wrangler-auth-'));
const text=(token,expiration='2099-01-01T00:00:00.000Z')=>`oauth_token = "${token}"\nexpiration_time = "${expiration}"\nrefresh_token = "unused-test-refresh"\n`;
try{
 const xdg=join(home,'xdg'),path=join(xdg,'.wrangler/config');await mkdir(path,{recursive:true});await writeFile(join(path,'default.toml'),text('test-xdg'));
 const options={home,platform:'darwin',env:{XDG_CONFIG_HOME:xdg}};
 assert.deepEqual(await legacyWranglerCredentials('4.45.4',options),{type:'oauth',token:'test-xdg'});
 const legacy=join(home,'.wrangler/config');await mkdir(legacy,{recursive:true});await writeFile(join(legacy,'default.toml'),text('test-legacy'));
 assert.equal((await legacyWranglerCredentials('4.45.4',options)).token,'test-legacy');
 await writeFile(join(legacy,'default.toml'),text('test-expired','2000-01-01T00:00:00.000Z'));
 await assert.rejects(legacyWranglerCredentials('4.45.4',options),/expired/);
 await assert.rejects(legacyWranglerCredentials('4.45.5',options),/version/);
 await assert.rejects(legacyWranglerCredentials('4.45.4',{...options,env:{...options.env,WRANGLER_PROFILE:'different'}}),/environment/);
 for(const env of [{WRANGLER_API_ENVIRONMENT:'staging'},{CLOUDFLARE_API_BASE_URL:'https://other.example'},{CF_API_BASE_URL:'https://other.example'}]){
  assert.throws(()=>assertProductionCloudflare(env));
  await assert.rejects(wranglerCredentials(home,env,async()=>{throw Error('Must not execute CLI')}),/not supported/);
 }
 assertProductionCloudflare({WRANGLER_API_ENVIRONMENT:'production',CLOUDFLARE_API_BASE_URL:'https://api.cloudflare.com/client/v4/'});
 let calls=0;assert.deepEqual(await wranglerCredentials(home,{},async(file,args)=>{calls++;assert.equal(file,'wrangler');assert.deepEqual(args,['auth','token','--json']);return '{"type":"oauth","token":"test-modern"}'}),{type:'oauth',token:'test-modern'});assert.equal(calls,1);
 console.log('Wrangler credential adapter passed: modern CLI, verified 4.45.4 file layout, XDG and legacy precedence, expiry/profile/version denial.');
}finally{await rm(home,{recursive:true,force:true})}
