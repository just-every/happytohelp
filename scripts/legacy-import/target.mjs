import {mkdir,mkdtemp,open,rm,unlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

/** A local Wrangler/rer persistence directory. Parallel applies to the same
 * directory are refused before any write. */
export async function localTarget(directory){
  await mkdir(directory,{recursive:true});
  const lockFile=path.join(path.resolve(directory),'.legacy-import.lock');let lock;
  try{lock=await open(lockFile,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Another legacy import holds the local persistence lock; finish it before applying again');throw e;}
  await lock.writeFile(String(process.pid));
  const {getPlatformProxy}=await import('wrangler');
  try{
    const proxy=await getPlatformProxy({remoteBindings:false,persist:{path:path.join(directory,'v3')}});
    return {env:proxy.env,label:`local ${directory}`,async close(){await proxy.dispose();await lock.close();await unlink(lockFile);}};
  }catch(error){await lock.close();await unlink(lockFile);throw error;}
}

// Wrangler's remote bindings (4.129) keep about one local workerd connection open
// per binding call until the session ends. A long import renews its session after
// this many calls, at a point with no call in flight, so it never runs the
// machine out of ephemeral ports.
const callsPerSession=1000;

/** A deployed installation's own D1 database and R2 bucket, reached through
 * Wrangler remote bindings with the operator's Cloudflare API token. Only the
 * DB and FILES bindings exist: no queue, mail, AI or other binding is created,
 * and the installation's Worker is never invoked. */
export async function remoteTarget({database,bucket}){
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  if(!account||!token)throw Error('A remote import needs the installation\'s deploy credentials: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN');
  if(!database||!bucket)throw Error('A remote import names the installation\'s D1 database (--database) and R2 bucket (--bucket)');
  const api=async route=>{const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${route}`,{headers:{Authorization:`Bearer ${token}`}});const body=await response.json().catch(()=>({}));if(!response.ok||!body.success)throw Error(`Cloudflare API ${route.split('?')[0]} returned ${response.status}`);return body.result;};
  const matches=(await api(`d1/database?name=${encodeURIComponent(database)}&per_page=100`)).filter(row=>row.name===database);
  if(matches.length!==1)throw Error(`D1 database ${database} was not found in this account`);
  const found=await api(`r2/buckets/${encodeURIComponent(bucket)}`);if(found.name!==bucket)throw Error(`R2 bucket ${bucket} was not found in this account`);
  const directory=await mkdtemp(path.join(tmpdir(),'h2h-legacy-remote-')),configPath=path.join(directory,'wrangler.json');
  await writeFile(configPath,JSON.stringify({name:'happytohelp-legacy-import',compatibility_date:'2026-09-08',d1_databases:[{binding:'DB',database_name:database,database_id:matches[0].uuid,remote:true}],r2_buckets:[{binding:'FILES',bucket_name:bucket,remote:true}]}),{mode:0o600});
  const {getPlatformProxy}=await import('wrangler');
  let proxy,env,calls=0,sessions=0;
  const connect=async()=>{proxy=await getPlatformProxy({configPath,remoteBindings:true,persist:false});env=counted(proxy.env,()=>calls++);calls=0;sessions++;};
  try{await connect();}catch(error){await rm(directory,{recursive:true,force:true});throw error;}
  return {
    get env(){return env;},label:`remote ${database} + ${bucket}`,database:matches[0].uuid,
    get sessions(){return sessions;},
    async renew(){if(calls<callsPerSession)return;await proxy.dispose();await connect();},
    async close(){await proxy.dispose();await rm(directory,{recursive:true,force:true});},
  };
}
// Each statement costs a prepare, a bind and an execution call.
function counted(env,count){
  const wrap=(target,costs)=>new Proxy(target,{get(object,key){const value=object[key];if(typeof value!=='function')return value;return (...args)=>{for(let i=0;i<(costs[key]??0);i++)count();return value.apply(object,args);};}});
  return {DB:wrap(env.DB,{prepare:3,batch:1}),FILES:wrap(env.FILES,{head:1,get:2,put:1,createMultipartUpload:3,delete:1})};
}
