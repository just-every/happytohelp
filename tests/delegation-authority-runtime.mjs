import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {getPlatformProxy} from 'wrangler'
import {authorityContract} from './delegation-authority.mjs'
const {consentRace}=await import('./delegation-consent-race.mjs')
import {collectMigrations} from '../scripts/migrations.mjs'
const {directory:migrations}=await collectMigrations()
const root=new URL('..',import.meta.url).pathname,dir=await mkdtemp(join(tmpdir(),'h2h-delegation-authority-')),config=join(dir,'wrangler.json'),persist=join(dir,'state')
let proxy
try{
 await writeFile(config,JSON.stringify({name:'h2h-delegation-authority',compatibility_date:'2026-09-08',d1_databases:[{binding:'DB',database_name:'delegation',database_id:'delegation-local',migrations_dir:migrations}]}))
 await promisify(execFile)(process.execPath,[join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--config',config,'--persist-to',persist],{env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'},maxBuffer:2*1024*1024})
 proxy=await getPlatformProxy({configPath:config,persist:{path:join(persist,'v3')}})
 await authorityContract(proxy.env.DB)
 await consentRace(proxy.env.DB)
 const before=(await proxy.env.DB.prepare("SELECT * FROM edition_receipts WHERE project_id='authority' ORDER BY operation_key").all()).results
 await proxy.dispose();proxy=undefined
 proxy=await getPlatformProxy({configPath:config,persist:{path:join(persist,'v3')}})
 assert.deepEqual((await proxy.env.DB.prepare("SELECT * FROM edition_receipts WHERE project_id='authority' ORDER BY operation_key").all()).results,before)
 console.log('Durability regression: all hash-only receipts survive local runtime disposal and reopening unchanged')
}finally{await proxy?.dispose();await rm(dir,{recursive:true,force:true})}
