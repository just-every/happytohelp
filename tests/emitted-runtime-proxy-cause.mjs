import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {createRuntime} from './helpers/emitted-runtime.mjs'
import {proxyFaultProbe} from './helpers/emitted-runtime-proxy-fault.mjs'

const runtime=await createRuntime();let proxy,success=false
try{
 const tenant=await runtime.seedTenant({name:'Proxy cause',email:'proxy-cause@native.test',allowedOrigin:runtime.origin})
 proxy=await proxyFaultProbe(runtime.origin)
 const warm=await fetch(proxy.origin+'/health');assert.equal(warm.status,200);assert.equal((await warm.json()).database,'reachable')
 const fresh=await fetch(runtime.origin+`/api/projects/${tenant.projectId}/local-agents/pairings`,{method:'POST',headers:{Authorization:`Bearer ${tenant.token}`,'Content-Type':'application/json'},body:'{}'})
 assert.equal(fresh.status,200);const pairing=(await fresh.json()).data
 const body=JSON.stringify({code:pairing.code,name:'Transport cause',provider:'codex',capabilities:['terminal']})
 const forwarded=proxy.forwarded;proxy.drop()
 const failed=await fetch(proxy.origin+'/api/local-agents/pair',{method:'POST',headers:{'Content-Type':'application/json'},body})
 const failure=await failed.text();assert.equal(failed.status,500);assert.doesNotMatch(failed.headers.get('Content-Type')||'',/application\/json/)
 assert.equal(proxy.dropped,1);assert.equal(proxy.forwarded,forwarded,'failed POST forwarded no application bytes')
 const errorDeadline=Date.now()+3000;while(proxy.errors.length===0&&Date.now()<errorDeadline)await new Promise(done=>setTimeout(done,25))
 assert.match(JSON.stringify(proxy.errors),/POST.*\/api\/local-agents\/pair.*failed after 1 attempt.*Network connection lost/)
 const before=await runtime.execute(`SELECT COUNT(*) AS redeemed FROM local_pairings WHERE id='${pairing.id}' AND redeemed_at IS NOT NULL; SELECT COUNT(*) AS devices FROM local_devices WHERE pairing_id='${pairing.id}';`)
 assert.match(before,/"redeemed": 0/);assert.match(before,/"devices": 0/)
 // A separate fresh capability exercises the selected native transport once.
 const directFresh=await fetch(runtime.origin+`/api/projects/${tenant.projectId}/local-agents/pairings`,{method:'POST',headers:{Authorization:`Bearer ${tenant.token}`,'Content-Type':'application/json'},body:'{}'})
 const directPairing=(await directFresh.json()).data
 const direct=await fetch(runtime.origin+'/api/local-agents/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:directPairing.code,name:'Native cause',provider:'codex',capabilities:['terminal']})})
 assert.equal(direct.status,200);assert.match(direct.headers.get('Content-Type'),/application\/json/);assert.equal((await direct.json()).data.pairing_id,directPairing.id)
 const evidence=resolve(process.env.H2H_EVIDENCE_DIR||'test-results/native-transport');await mkdir(evidence,{recursive:true})
 await writeFile(join(evidence,'proxy-cause-native-runtime.log'),runtime.logs)
 await writeFile(join(evidence,'proxy-cause.json'),JSON.stringify({passed:true,probe:'controlled TCP close before forwarding, installed official Wrangler ProxyWorker → real emitted application',failureStatus:failed.status,failureExcerpt:failure.slice(0,300),proxyErrors:proxy.errors,failedPostAttempts:1,applicationBytesForwarded:proxy.forwarded-forwarded,unconsumedCapability:before,nativeFreshPairStatus:direct.status,limitation:'This isolates and reproduces the observed proxy connection-loss signature. It does not assert that the original CI connection was closed by the idle timer.'},null,2))
 success=true;console.log('Proxy cause PASS: installed Wrangler proxy dropped downstream POST yields non-JSON 500 after one attempt, no application bytes or D1 consumption; real native HTTP fresh pairing returns JSON 200 once.')
}finally{await proxy?.close();await runtime.close(success)}
