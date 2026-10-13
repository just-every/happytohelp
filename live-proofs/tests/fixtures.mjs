import { digest } from '../artifact.mjs';
export const sha = '1'.repeat(40);
export function candidate() {
  const sql = 'CREATE TABLE sample(id TEXT PRIMARY KEY);';
  return {schema:1,mainModule:'index.js',modules:[{name:'index.js',type:'esm',contentBase64:Buffer.from('export default {fetch(){return new Response("ok")}}; export class ConversationSocket {}').toString('base64')}],
    assets:[{path:'/index.html',contentBase64:Buffer.from('<p>test</p>').toString('base64'),contentType:'text/html'}],
    deploymentSpec:{schema:1,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],
      resources:[{kind:'d1',binding:'DB'},{kind:'r2',binding:'FILES'},{kind:'queue',binding:'JOBS'},{kind:'queue',binding:'JOBS_DEAD_LETTER'}],
      durableObjects:[{binding:'CONVERSATIONS',className:'ConversationSocket'}],durableObjectMigrations:[{tag:'v1',newSqliteClasses:['ConversationSocket']}],
      schedules:['* * * * *'],queueConsumers:[{binding:'JOBS',maxBatchSize:1,maxBatchTimeout:5,maxRetries:0,deadLetterBinding:'JOBS_DEAD_LETTER'}],
      publicVariables:{},healthPath:'/health',migrations:[{binding:'DB',name:'0001_initial.sql',sql,sha256:digest(sql)}]}};
}
export function policy(artifact=candidate()) {
  return {schema:1,isolation:'dedicated-stage',accountId:'a'.repeat(32),prefix:'fixture-stage',databaseId:'12345678-1234-1234-1234-123456789abc',
    origin:'https://fixture-stage.fixture.workers.dev',sourceSha:sha,artifactSha256:digest(packageCandidate(artifact).raw)};
}
export function env(overrides={}) {
  const p = policy();
  return {VALIDATED_SHA:sha,CONTROL_SHA:'2'.repeat(40),GITHUB_REPOSITORY:'just-every/run-happytohelp',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',
    MODE:'proof',INPUT_PROOF:'secrets-present',PREPARE_RESULT:'success',JOB_RESULT:'success',EXECUTION_RESULT:'passed',
    CLOUDFLARE_API_TOKEN:'test-provider-token',H2H_SETUP_TOKEN:'test-setup-token-that-is-at-least-32-characters',
    CLOUDFLARE_ACCOUNT_ID:p.accountId,H2H_RESOURCE_PREFIX:p.prefix,H2H_PUBLIC_ORIGIN:p.origin,H2H_STAGE_POLICY_JSON:JSON.stringify(p),...overrides};
}

// Test-only conversion of the existing byte fixtures, preserving all their
// invalid-byte assertions. The application accepts schema 2 only.
export function packageCandidate(source) {
 const artifact = structuredClone(source), payloads = new Map(); artifact.schema = 2;
 for (const group of ['modules','assets']) artifact[group] = artifact[group].map((entry,index) => {
  const {contentBase64,...metadata}=entry, bytes=Buffer.from(contentBase64,'base64');
  if(bytes.toString('base64')!==contentBase64)throw Error('invalid-test-byte-encoding');
  const payload=`payload/${group}/${String(index).padStart(6,'0')}`;payloads.set(payload,bytes);
  return {...metadata,role:group==='modules'?'module':'asset',payload,size:bytes.length,sha256:digest(bytes)};
 });
 return {raw:JSON.stringify(artifact),payloads};
}
export async function writeCandidate(file, source) {
 const {mkdir,writeFile}=await import('node:fs/promises'),{dirname,join}=await import('node:path');
 const {raw,payloads}=packageCandidate(source);
 for(const [name,bytes]of payloads){const path=join(dirname(file),name);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);}
 await writeFile(file,raw);return raw;
}
