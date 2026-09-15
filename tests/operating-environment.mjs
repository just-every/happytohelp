import assert from 'node:assert/strict'
import {readdir,readFile,stat} from 'node:fs/promises'
import {secretNames,variableNames,runtimeVariables,runtimeSecrets,validateRuntimeEnvironment} from '../scripts/deployment/environment.mjs'
import {withSecretJsonFile} from '../scripts/deployment/secret-json.mjs'
import {waitForDeploymentHealth} from '../scripts/deployment/health.mjs'
const known=new Set([...secretNames,...variableNames,'APP_ORIGIN','DB','FILES','JOBS','CONVERSATIONS'])
async function inspect(directory){for(const item of await readdir(directory,{withFileTypes:true})){if(item.name==='vendor')continue;const path=directory+'/'+item.name;if(item.isDirectory())await inspect(path);else if(/\.(?:ts|tsx)$/.test(item.name))for(const [,key]of(await readFile(path,'utf8')).matchAll(/(?:\benv\.|\bsecret\(')([A-Z][A-Z0-9_]+)/g))assert.ok(known.has(key),`Undeclared native runtime binding ${key} in ${path}`)}}
await inspect('src/modules');await inspect('src/platform')
const fixture={EMAIL_API_KEY:'private-fixture',EMAIL_FROM:'sender@example.invalid',OPENAI_API_KEY:'model-fixture',DEEPSEEK_API_KEY:'selected-fixture',CONTEXT_MODEL:'selected-model',PREVIEW_ORIGIN:'https://preview.example.invalid',APP_ORIGIN:'https://app.example.invalid'}
assert.deepEqual(runtimeVariables(fixture),{CONTEXT_MODEL:'selected-model',PREVIEW_ORIGIN:'https://preview.example.invalid'})
for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','WAITLIST_NOTIFY_EMAIL'])assert.ok(!(name in runtimeSecrets({[name]:'retired'})))
for(const name of ['BILLING_CURRENCY','PUBLIC_WIDGET_PROJECT_ID','PUBLIC_DEMO_ENABLED'])assert.ok(!(name in runtimeVariables({[name]:'retired'})))
assert.equal(runtimeSecrets(fixture).EMAIL_API_KEY,'private-fixture');assert.ok(!('SENDGRID_API_KEY' in runtimeSecrets({SENDGRID_API_KEY:'obsolete'})))
assert.throws(()=>validateRuntimeEnvironment({...fixture,PREVIEW_ORIGIN:fixture.APP_ORIGIN}),/separate/);assert.throws(()=>validateRuntimeEnvironment({QDRANT_URL:'https://secret:password@example.invalid'}),/credentials/);assert.throws(()=>validateRuntimeEnvironment({TRAINING_PRICE_CEILINGS:'{"model":{"inputPerMillion":0,"outputPerMillion":1}}'}),/positive/)
let secretPath;await withSecretJsonFile(runtimeSecrets(fixture),async path=>{secretPath=path;assert.equal((await stat(path)).mode&0o777,0o600);assert.equal(JSON.parse(await readFile(path,'utf8')).EMAIL_API_KEY,'private-fixture')});await assert.rejects(stat(secretPath))
await waitForDeploymentHealth('https://example.invalid/health',{fetchImpl:async()=>Response.json({status:'ok',runtime:'native-rer',database:'reachable',files:'reachable'})});await assert.rejects(waitForDeploymentHealth('https://example.invalid/health',{fetchImpl:async()=>Response.json({status:'ok'})}),/unexpected/)
console.log('Operating configuration: source binding inventory, secret separation/cleanup, invalid capability configuration and native health identity passed; no network calls')
