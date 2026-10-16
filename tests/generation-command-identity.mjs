// Scheduled replay of an email-admitted customer message must reach the same
// generation command the email Worker requested, whatever key order each writer
// used to serialize the actor, so the conversation outbox is marked delivered.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

const require=createRequire(import.meta.url)
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('wrangler')]}))
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}))
const bundle=await build({entryPoints:[fileURLToPath(new URL('./helpers/generation-command-identity-worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',target:'es2022',external:['node:*'],logLevel:'silent'})
let outboundCalls=0
// All SQL, application calls and existing semantic assertions execute in the
// Worker against native D1. Only the request/result crosses the async transport.
const runtime=new Miniflare(convertV4MiniflareOptions({
 modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],
 d1Databases:['DB'],r2Buckets:['FILES'],
 outboundService:async()=>{outboundCalls++;throw new Error('Generation identity must not call a provider')},
}))
try{
 const directory=new URL('../migrations/',import.meta.url)
 const files=(await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()
 const migrations=await Promise.all(files.map(file=>readFile(new URL(file,directory),'utf8')))
 const response=await runtime.dispatchFetch('http://generation-identity.test/',{method:'POST',body:JSON.stringify(migrations)})
 assert.equal(response.status,200,await response.clone().text())
 assert.deepEqual(await response.json(),{ok:true})
 assert.equal(outboundCalls,0,'command admission and scheduled replay never execute a provider')
 console.log('generation command identity: ok')
}finally{await runtime.dispose()}
