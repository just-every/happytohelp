import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {getPlatformProxy} from 'wrangler'
process.env.H2H_DELEGATION_RUNTIME='1'
const {runContract}=await import('./delegation-sqlite.mjs')
const {collectMigrations}=await import('../scripts/migrations.mjs')
const {directory:migrations}=await collectMigrations()
const root=new URL('..',import.meta.url).pathname,dir=await mkdtemp(join(tmpdir(),'h2h-edition-delegation-')),config=join(dir,'wrangler.json'),persist=join(dir,'state')
let proxy
try{
 await writeFile(config,JSON.stringify({name:'h2h-delegation-contract',compatibility_date:'2026-09-08',d1_databases:[{binding:'DB',database_name:'delegation',database_id:'delegation-local',migrations_dir:migrations}]}))
 await promisify(execFile)(process.execPath,[join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--config',config,'--persist-to',persist],{env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'},maxBuffer:2*1024*1024})
 proxy=await getPlatformProxy({configPath:config,persist:{path:join(persist,'v3')}})
 await runContract(proxy.env.DB)
 console.log('Real D1 delegation contract passed: native consent, code replay, PKCE, article publication, exact receipts, native stale edits, audience changes, erasure, revocation.')
}finally{await proxy?.dispose();await rm(dir,{recursive:true,force:true})}
