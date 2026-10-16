import assert from 'node:assert/strict'
import {readdir,readFile} from 'node:fs/promises'
import {secretNames,variableNames,serviceBindingNames,runtimeVariables,runtimeSecrets,validateRuntimeEnvironment} from '../scripts/deployment/environment.mjs'
const known=new Set([...secretNames,...variableNames,...serviceBindingNames,'APP_ORIGIN','DB','FILES','JOBS','CONVERSATIONS'])
// Vite substitutes import.meta.env at compile time; it is not a Worker binding.
async function inspect(directory){for(const item of await readdir(directory,{withFileTypes:true})){if(item.name==='vendor')continue;const path=directory+'/'+item.name;if(item.isDirectory())await inspect(path);else if(/\.(?:ts|tsx)$/.test(item.name))for(const [,key]of(await readFile(path,'utf8')).matchAll(/(?:(?<!import\.meta\.)\benv\.|\bsecret\(')([A-Z][A-Z0-9_]+)/g))assert.ok(known.has(key),`Undeclared native runtime binding ${key} in ${path}`)}}
await inspect('src/modules');await inspect('src/platform')
const fixture={EMAIL_API_KEY:'private-fixture',EMAIL_FROM:'sender@example.invalid',OPENAI_API_KEY:'model-fixture',DEEPSEEK_API_KEY:'selected-fixture',CONTEXT_MODEL:'selected-model',PREVIEW_ORIGIN:'https://preview.example.invalid',APP_ORIGIN:'https://app.example.invalid'}
assert.deepEqual(runtimeVariables(fixture),{CONTEXT_MODEL:'selected-model',PREVIEW_ORIGIN:'https://preview.example.invalid'})
for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','WAITLIST_NOTIFY_EMAIL'])assert.ok(!(name in runtimeSecrets({[name]:'retired'})))
for(const name of ['BILLING_CURRENCY','PUBLIC_WIDGET_PROJECT_ID','PUBLIC_DEMO_ENABLED'])assert.ok(!(name in runtimeVariables({[name]:'retired'})))
assert.equal(runtimeSecrets(fixture).EMAIL_API_KEY,'private-fixture');assert.ok(!('SENDGRID_API_KEY' in runtimeSecrets({SENDGRID_API_KEY:'obsolete'})))
assert.throws(()=>validateRuntimeEnvironment({...fixture,PREVIEW_ORIGIN:fixture.APP_ORIGIN}),/separate/);assert.throws(()=>validateRuntimeEnvironment({QDRANT_URL:'https://secret:password@example.invalid'}),/credentials/);assert.throws(()=>validateRuntimeEnvironment({TRAINING_PRICE_CEILINGS:'{"model":{"inputPerMillion":0,"outputPerMillion":1}}'}),/positive/)
console.log('Operating configuration: source binding inventory, secret selection and invalid capability configuration passed; no network calls')

assert.equal(runtimeVariables({RER_MANAGEMENT_ORIGIN:'https://manage.example.invalid'}).RER_MANAGEMENT_ORIGIN,'https://manage.example.invalid')
for(const origin of ['http://manage.example.invalid','https://manage.example.invalid/path','https://user:password@manage.example.invalid','https://manage.example.invalid?token=x'])assert.throws(()=>validateRuntimeEnvironment({RER_MANAGEMENT_ORIGIN:origin}))
const helpHosts=JSON.stringify({'help.example.test':'retained-project-slug'})
assert.equal(runtimeVariables({...fixture,PUBLIC_HELP_HOSTS:helpHosts}).PUBLIC_HELP_HOSTS,helpHosts)
for(const map of [[],{'*.example.test':'p'},{'https://help.example.test':'p'},{'HELP.example.test':'p'},{'help.example.test':''},{'app.example.invalid':'p'}])assert.throws(()=>validateRuntimeEnvironment({...fixture,PUBLIC_HELP_HOSTS:JSON.stringify(map)}))
