import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { targetPolicy } from './target.mjs';
import { materializeArtifact } from './artifact.mjs';

export function configuration(target) {
  const p = target.prefix;
  return {
    name:p, account_id:target.accountId, main:'modules/index.js', no_bundle:true,
    compatibility_date:'2026-09-08', compatibility_flags:['nodejs_compat'],
    workers_dev:true, preview_urls:false,
    assets:{directory:'assets',binding:'ASSETS'},
    find_additional_modules:true,
    rules:[{type:'ESModule',globs:['**/*.js'],fallthrough:true},{type:'CompiledWasm',globs:['**/*.wasm'],fallthrough:true},{type:'Text',globs:['**/*.html','**/*.txt','**/*.json'],fallthrough:true}],
    vars:{APP_ORIGIN:target.origin,REGISTRATION_ENABLED:'false'},
    d1_databases:[{binding:'DB',database_name:`${p}-db`,database_id:target.databaseId,migrations_dir:'migrations'}],
    r2_buckets:[{binding:'FILES',bucket_name:`${p}-files`}],
    durable_objects:{bindings:[{name:'CONVERSATIONS',class_name:'ConversationSocket'}]},
    migrations:[{tag:'v1',new_sqlite_classes:['ConversationSocket']}],
    queues:{producers:[{binding:'JOBS',queue:`${p}-jobs`},{binding:'JOBS_DEAD_LETTER',queue:`${p}-jobs-dead`}],
      consumers:[{queue:`${p}-jobs`,max_batch_size:1,max_batch_timeout:5,max_retries:0,dead_letter_queue:`${p}-jobs-dead`}]},
    triggers:{crons:['* * * * *']},
  };
}
// No stdout/stderr from the provider or source bytes enters logs or receipts.
export function invokeWrangler(tool, args, cwd, env) {
  return spawnSync(process.execPath, [tool,...args], {cwd,env,stdio:'ignore',timeout:15*60*1000}).status === 0;
}
export async function health(origin, request = fetch) {
  for (let attempt = 0; attempt < 15; attempt++) {
    let response;
    try { response = await request(`${origin}/health`, {redirect:'manual',signal:AbortSignal.timeout(5000)}); } catch {}
    if (response?.ok) {
      const body = await response.json().catch(() => null);
      return body?.status === 'ok' && body?.runtime === 'native-rer' && body?.database === 'reachable' && body?.files === 'reachable';
    }
    if (response && ![404,503].includes(response.status)) return false;
    if (attempt < 14) await new Promise(r => setTimeout(r,2000));
  }
  return false;
}
export async function deployStage({sha, artifact, env=process.env, invoke=invokeWrangler, checkHealth=health}) {
  const target = targetPolicy(env.H2H_STAGE_POLICY_JSON,sha);
  if (env.CLOUDFLARE_ACCOUNT_ID !== target.accountId || env.H2H_RESOURCE_PREFIX !== target.prefix || env.H2H_PUBLIC_ORIGIN !== target.origin)
    throw new Error('invalid-stage-policy');
  if (!env.CLOUDFLARE_API_TOKEN?.trim() || (env.H2H_SETUP_TOKEN?.trim().length ?? 0) < 32)
    return {result:'missing-secret'};
  const cwd = await mkdtemp(join(env.RUNNER_TEMP,'h2h-stage-'));
  try {
    await materializeArtifact(artifact,cwd,target.artifactSha256);
    await writeFile(join(cwd,'wrangler.json'),JSON.stringify(configuration(target)),{flag:'wx',mode:0o600});
    await writeFile(join(cwd,'secrets.json'),JSON.stringify({H2H_SETUP_TOKEN:env.H2H_SETUP_TOKEN}),{flag:'wx',mode:0o600});
    const childEnv = {PATH:env.PATH,HOME:cwd,CI:'true',WRANGLER_SEND_METRICS:'false',
      CLOUDFLARE_API_TOKEN:env.CLOUDFLARE_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:target.accountId};
    const tool = resolve(import.meta.dirname,'toolchain/node_modules/wrangler/bin/wrangler.js');
    if (!invoke(tool,['d1','migrations','apply','DB','--remote','--config','wrangler.json'],cwd,childEnv)) return {result:'migration-failed'};
    if (!invoke(tool,['deploy','--no-bundle','--config','wrangler.json','--secrets-file','secrets.json'],cwd,childEnv)) return {result:'deploy-failed'};
    if (!await checkHealth(target.origin)) return {result:'health-failed'};
    return {result:'passed',artifactSha256:target.artifactSha256};
  } finally { await rm(cwd,{recursive:true,force:true}); }
}
