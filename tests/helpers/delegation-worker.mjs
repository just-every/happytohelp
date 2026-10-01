import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
const root=resolve(new URL('../..',import.meta.url).pathname)
const freePort=()=>new Promise((done,fail)=>{const s=createServer();s.once('error',fail);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p))})})
/**
 * Start the emitted Worker on its own local D1 database. `installation` sets RER_INSTALLATION_ID
 * (delegation is unavailable without it). A fixed `port` also fixes the inspector at port+1.
 */
export async function startDelegationWorker({port=0,installation=true}={}){
 const directory=await mkdtemp(join(tmpdir(),'h2h-delegation-pages-')),configPath=join(directory,'wrangler.json'),persist=join(directory,'state'),server=join(root,'dist/server')
 const emitted=JSON.parse(await readFile(join(server,'wrangler.json'),'utf8')),wrangler=join(root,'node_modules/wrangler/bin/wrangler.js'),setupToken='delegation-pages-private-setup-token'
 const chosen=port||await freePort(),origin='http://127.0.0.1:'+chosen
 const config={...emitted,name:'h2h-delegation-pages',main:resolve(server,emitted.main),assets:{directory:resolve(server,emitted.assets.directory)},d1_databases:[{binding:'DB',database_name:'delegation-pages',database_id:'delegation-pages-local',migrations_dir:join(root,'.generated/migrations')}],r2_buckets:[{binding:'FILES',bucket_name:'delegation-pages-files'}],queues:{producers:[{binding:'JOBS',queue:'delegation-pages-jobs'}]},vars:{...(installation?{RER_INSTALLATION_ID:'delegation-pages-installation'}:{}),H2H_SETUP_TOKEN:setupToken},no_bundle:true}
 await writeFile(configPath,JSON.stringify(config))
 const env={...process.env,CI:'1',WRANGLER_SEND_METRICS:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'}
 await promisify(execFile)(process.execPath,[wrangler,'d1','migrations','apply','DB','--local','--config',configPath,'--persist-to',persist],{env,maxBuffer:4*1024*1024})
 let logs='';const child=spawn(process.execPath,[wrangler,'dev','--local','--config',configPath,'--port',String(chosen),'--inspector-port',port?String(port+1):'0','--ip','127.0.0.1','--persist-to',persist],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
 const stop=async success=>{child.kill('SIGTERM');await Promise.race([new Promise(r=>child.exitCode!==null?r():child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null)child.kill('SIGKILL');if(success)await rm(directory,{recursive:true,force:true});else{await writeFile(join(directory,'runtime.log'),logs);console.error('Worker artifacts retained:',directory)}}
 let ready=false;for(let n=0;n<200;n++){try{if((await fetch(origin+'/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,250))}
 if(!ready){await stop(false);throw new Error('Emitted Worker did not start:\n'+logs)}
 return {origin,setupToken,stop,async bootstrapOwner(context,name){const response=await context.request.post(origin+'/api/identity/bootstrap',{data:{name,ownerName:'Owner',email:'owner@delegation-pages.test',password:'delegation-pages-password',allowedOrigin:origin,setupToken}});if(response.status()!==201)throw new Error(await response.text());return (await response.json()).projectId}}
}
