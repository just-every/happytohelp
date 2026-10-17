import {consumeJob as consumeCentral} from '../src/jobs'
import {recoverTrainingRuns} from '../src/modules/training-runs/recovery'
import {recoverContextJobs} from '../src/modules/customer-context/jobs'
import {recoverBrandJobs} from '../src/modules/site-preview/brand'
import migrations from 'migration-fixtures'
import type {Env} from '../src/platform/env'
import {isProjectActive,requireActiveProject} from '../src/platform/project-status'
import {executeTrainingRun} from '../src/modules/training-runs/runner'
import {consumeContextJob} from '../src/modules/customer-context/engine'
import {consumeJob as consumeBrand} from '../src/modules/site-preview/brand'
import {projects} from '../src/modules/management/projects'
import {hashToken} from '../src/platform/auth'
export default {async fetch(request:Request,env:Env){
 if(new URL(request.url).pathname!=='/test')return new Response('test runner');let checks=0;
 const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);checks++};
 try{
 for(const migration of migrations)for(const statement of migration.statements)try{await env.DB.prepare(statement).run()}catch(error){throw new Error(`${migration.name}: ${String(error)}`)}
 const projectId='deleted-background';const now=Date.now();
 await env.DB.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,?)').bind(projectId,'Background','widget','https://example.com',now).run();
 await env.DB.prepare('INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)').bind('owner','owner@example.com','Owner',now).run();
 await env.DB.prepare("INSERT INTO memberships(project_id,user_id,role) VALUES(?,?,'owner')").bind(projectId,'owner').run();
 await env.DB.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,?)').bind(projectId,'{}',now).run();
 await env.DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,'owner',?,'owner',?)").bind(await hashToken('test-owner'),projectId,now+60000).run();
 await env.DB.prepare("INSERT INTO session_factors(token_hash,user_id,method,verified_at) VALUES(?,'owner','password',?)").bind(await hashToken('test-owner'),Date.now()).run();
 check(await isProjectActive(env,projectId),'canonical live project active');check(!await isProjectActive(env,'missing-project'),'missing canonical project inactive');
 await env.DB.prepare("CREATE TRIGGER reject_test_revocation BEFORE DELETE ON memberships BEGIN SELECT RAISE(ABORT,'test membership failure'); END").run();
 const failedDelete=await projects.request(`/projects/${projectId}`,{method:'DELETE',headers:{Authorization:'Bearer test-owner'}},env);
 check(failedDelete.status===500,'injected membership revocation failure rejects deletion');
 check(await isProjectActive(env,projectId)&&!!await env.DB.prepare('SELECT role FROM memberships WHERE project_id=?').bind(projectId).first(),'membership failure rolls back deletion and membership revocation atomically');
 await env.DB.prepare('DROP TRIGGER reject_test_revocation').run();
 const deleted=await projects.request(`/projects/${projectId}`,{method:'DELETE',headers:{Authorization:'Bearer test-owner'}},env);check(deleted.status===200,`management DELETE succeeds: ${await deleted.text()}`);
 check(!await isProjectActive(env,projectId),'management deletion makes project inactive');
 let denied=false;try{await requireActiveProject(env,projectId)}catch{denied=true}check(denied,'required active project rejects deletion');
 for(const [id,status,reserved] of [['queued','queued',0],['running','running',4]] as const){
 await env.DB.prepare('INSERT INTO training_runs(id,project_id,operator_id,request_id,kind,status,config,case_count,max_cost,max_tokens,reserved_cost,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,projectId,'owner',id,'evaluation',status,'{}',1,10,100,reserved,now).run();
 await env.DB.prepare('INSERT INTO training_cases(id,run_id,case_id,model,variant,definition,status,attempt_id,started_at,lease_expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,id,id,'fixture','default','{}',status,status==='running'?'retained-attempt':null,status==='running'?now:null,status==='running'?now+900000:null).run();
 }
 await env.DB.prepare("INSERT INTO context_jobs(id,project_id,subject_id,kind,state,source_revision,packet_json,model,created_at) VALUES('context',?,'subject','project','queued',0,'{}','fixture',?)").bind(projectId,now).run();
 await env.DB.prepare("INSERT INTO brand_generations(id,project_id,actor_id,request_id,prompt,model,size,quality,state,created_at,expires_at) VALUES('brand',?,'owner','brand-request','Mark','fixture','1024x1024','low','queued',?,?)").bind(projectId,now,now+900000).run();
 let providerCalls=0;let executorCalls=0;const originalFetch=globalThis.fetch;
 globalThis.fetch=(async()=>{providerCalls++;throw new Error('Provider called for deleted project')}) as typeof fetch;
 try{
 let dispatched=0;const recovering={...env,JOBS:{send:async()=>{dispatched++}}} as unknown as Env;
 for(const job of [{type:'training',id:'queued',projectId},{type:'context.run',id:'context',projectId},{type:'brand.generate',id:'brand',projectId}])await consumeCentral(job,recovering);
 check(providerCalls===0&&(await env.DB.prepare("SELECT state FROM context_jobs WHERE id='context'").first<any>()).state==='queued','central dispatcher blocks deleted background jobs before module work');
 await recoverTrainingRuns(recovering);await recoverContextJobs(recovering);await recoverBrandJobs(recovering);check(dispatched===0,'deleted background recovery dispatches zero jobs');
 const executor=async()=>{executorCalls++;throw new Error('Training executor called for deleted project')};
 await executeTrainingRun(env,'queued',executor);await executeTrainingRun(env,'running',executor);
 await consumeContextJob({type:'context.run',id:'context',projectId},env,async()=>{providerCalls++;throw new Error('Context provider called')});
 await consumeBrand({type:'brand.generate',id:'brand',projectId},{...env,OPENAI_API_KEY:'fixture'});
 check(providerCalls===0&&executorCalls===0,'deleted background jobs execute zero providers or training executors');
 const running=await env.DB.prepare("SELECT status,reserved_cost,spent_cost FROM training_runs WHERE id='running'").first<any>();check(running.status==='uncertain'&&running.reserved_cost===4&&running.spent_cost===0,'running training reservation remains uncertain and retained');
 check((await env.DB.prepare("SELECT status,attempt_id FROM training_cases WHERE id='running'").first<any>()).status==='uncertain','running case retained as uncertain');
 check((await env.DB.prepare("SELECT status FROM training_runs WHERE id='queued'").first<any>()).status==='cancelled','unstarted training is cancelled');
 check((await env.DB.prepare("SELECT state,provider_started FROM context_jobs WHERE id='context'").first<any>()).provider_started===0,'context provider never starts');
 check((await env.DB.prepare("SELECT state FROM brand_generations WHERE id='brand'").first<any>()).state==='failed','brand job fails before provider dispatch');
 }finally{globalThis.fetch=originalFetch}
 await env.FILES.put('deleted-background/proof.json',JSON.stringify({checks}));check(!!await env.FILES.get('deleted-background/proof.json'),'real R2 binding available');
 return Response.json({passed:checks,runtime:'workerd',database:'real local D1 with all canonical migrations',storage:'real local R2',providerCalls:0})
 }catch(error){return Response.json({error:String(error),checks},500)}
}}
