import conversations from '../migrations/0002_conversations.sql'
import context from '../migrations/0060_customer_context.sql'
import contextEngine from '../migrations/0060_customer_context_engine.sql'
import ai from '../migrations/020_ai_support.sql'
import delegation from '../migrations/0105_edition_delegation.sql'
import citations from '../migrations/0108_public_answer_citations.sql'
import {testDeletedKnowledgeProjects} from './knowledge-deleted-projects'
import identitySchema from '../migrations/0001_identity.sql'
import widgetIdentitySchema from '../migrations/0005_widget_identity.sql'
import {hashToken} from '../src/platform/auth'
import {queueImport} from '../src/modules/knowledge/import-jobs'
import importsSchema from '../migrations/0052_knowledge_imports.sql'
import recoverySchema from '../migrations/0053_knowledge_recovery.sql'
import managementSchema from '../migrations/0070_management.sql'
import {testKnowledgeRecovery} from './knowledge-recovery'
import {refreshDataset,consumeJob,searchKnowledge,maximalMarginalRelevance} from '../src/modules/knowledge/service'
import {routes} from '../src/modules/knowledge/routes'
import {htmlToMarkdown} from '../src/modules/knowledge/importers'
import type {Env,Job} from '../src/platform/env'
import schema from '../migrations/0050_knowledge.sql'
import authoring from '../migrations/0051_knowledge_authoring.sql'
export default {async fetch(request:Request,env:Env){
 env={...env,APP_ORIGIN:new URL(request.url).origin};
 if(new URL(request.url).pathname!=='/test')return new Response('test runner');
 let checks=0;const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);checks++};
 try{
 for(const [,sql] of `${identitySchema}\n${widgetIdentitySchema}\n${conversations}\n${schema}\n${authoring}\n${importsSchema}\n${recoverySchema}\n${managementSchema}\n${context}\n${contextEngine}\n${ai}\n${delegation}\n${citations}`.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await env.DB.prepare(sql).run();
 await env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Project','widget','https://example.com',0); ").run();
 await env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('other','Other','other-widget','https://other.example.com',0)").run();
 await env.DB.prepare("INSERT INTO knowledge_datasets(id,project_id,name,created_at) VALUES('dataset','p','Corpus',?)").bind(Date.now()).run();
 const jobs:Job[]=[];const testing={...env,JOBS:{send:async(job:Job)=>{jobs.push(job)}}} as unknown as Env;
 const documents=Array.from({length:138},(_,i)=>({url:`https://example.com/${i}`,title:`Page ${i}`,content:`Corpus article ${i} `+'body '.repeat(230)}));
 await refreshDataset(testing,'p','dataset',{documents});let pages=0;while(jobs.length){const job=jobs.shift()!;await consumeJob(job,testing);await consumeJob(job,testing);pages++}
 check(pages===8,'138 documents must publish over durable pages');
 check((await env.DB.prepare('SELECT COUNT(*) n FROM knowledge_documents').first<{n:number}>())?.n===138,'all 138 documents indexed');
 check((await searchKnowledge(env,'p','Corpus')).length===3,'lexical ranking');check((await searchKnowledge(env,'other','Corpus')).length===0,'cross tenant search');
 await refreshDataset(testing,'p','dataset',{documents:[]});while(jobs.length)await consumeJob(jobs.shift()!,testing);
 check((await searchKnowledge(env,'p','Corpus')).length===3,'failed refresh retains published corpus');
 let semanticError='';try{await searchKnowledge(env,'p','Corpus','semantic')}catch(e){semanticError=String(e)}check(semanticError.includes('SEMANTIC_INDEX_UNAVAILABLE'),'semantic cannot silently fall back');
 await env.DB.prepare("INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES('draft','p','draft','Private','Draft body','draft',0),('pub','p','published','Public','Published body','published',0)").run();
 await env.DB.prepare("INSERT INTO users(id,email,name,created_at) VALUES('owner','owner@example.com','Owner',0)").run();await env.DB.prepare("INSERT INTO memberships(project_id,user_id,role) VALUES('p','owner','owner')").run();await env.DB.prepare("INSERT INTO sessions(token_hash,actor_id,project_id,role,expires_at) VALUES(?,'owner','p','owner',?)").bind(await hashToken('owner-test'),Date.now()+60000).run();
 const send=async(path:string,method:string,body:unknown)=>routes.request(path,{method,headers:{Authorization:'Bearer owner-test','Content-Type':'application/json'},body:JSON.stringify(body)},env);
 const categoryResponse=await send('/p/categories','POST',{title:'Category',summary:'Summary'});check(categoryResponse.status===201,'original category fields and automatic slug');const category=await categoryResponse.json<any>();
 const articleResponse=await send('/p/articles','POST',{title:'Authored',summary:'Cobalt zephyr',content:'Copper horizon',categories:[category.id],is_published:true});check(articleResponse.status===201,'article multicategory authoring');const authored=await articleResponse.json<any>();
 const readArticles=async(query:string)=>routes.request(`/p/articles?q=${encodeURIComponent(query)}`,{headers:{Authorization:'Bearer owner-test'}},env);
 for(const phrase of ['Authored','Cobalt zephyr','Copper horizon']){
  const response=await readArticles(phrase);check(response.status===200,'authoring search succeeds');
  const rows=await response.json<any[]>();check(rows.length===1&&rows[0].id===authored.id,'authoring finds title, summary and body through the server');
 }
 check((await (await readArticles('no matching phrase')).json<any[]>()).length===0,'authoring search has an empty result');
 check((await (await readArticles('   ')).json<any[]>()).some(row=>row.id===authored.id),'clearing authoring search restores the library');
 check((await routes.request('/p/articles?q=Cobalt',{},env)).status===401,'article search requires an actor');
 check((await routes.request('/other/articles?q=Cobalt',{headers:{Authorization:'Bearer owner-test'}},env)).status===403,'article search requires current project authority');
 await env.DB.prepare("UPDATE knowledge_articles SET summary='Cobalt zephyr' WHERE id='draft'").run();
 await env.DB.prepare("INSERT INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at) VALUES('foreign','other','foreign','Foreign','Foreign body','Cobalt zephyr','published',0)").run();
 const authorMatches=await (await readArticles('Cobalt zephyr')).json<any[]>();check(authorMatches.some(row=>row.id==='draft')&&!authorMatches.some(row=>row.id==='foreign'),'authoring search includes owned drafts and excludes other projects');
 const summarySearch=await routes.request('/public/p/search?q=Cobalt%20zephyr',{},env);check(summarySearch.status===200,'public summary search needs no actor');
 const summaryMatches=await summarySearch.json<any[]>();check(summaryMatches.length===1&&summaryMatches[0].id===authored.id,'public summary search excludes drafts and other tenants');
 check((await send(`/p/categories/${category.id}`,'PUT',{title:'Cycle',parent_id:category.id})).status===400,'category cycles denied');
 check((await send('/other/articles','POST',{title:'Cross tenant',content:'No',is_published:true})).status===403,'cross tenant authoring denied');
 await send(`/p/articles/${authored.id}`,'DELETE',{});
 const publicResponse=await routes.request('/public/p/articles',{},env);check(publicResponse.status===200,'public helpcenter does not need actor');check((await publicResponse.json<any[]>()).length===1,'draft article excluded');
 check((await routes.request('/public/p/articles/draft',{},env)).status===404,'draft direct read blocked');
 const mmr=maximalMarginalRelevance([1,0],[{vector:[1,0],id:1},{vector:[0,1],id:2}],1);check(mmr[0].id===1,'Python per-collection k1 MMR selection');
 const markdown=await htmlToMarkdown('<h2>Help</h2><p>A <a href="https://example.com">link</a></p><script>bad()</script>');check(markdown.includes('## Help')&&markdown.includes('[link](https://example.com)')&&!markdown.includes('bad()'),'native HTML import conversion');
 const actualFetch=globalThis.fetch;
 const points:any[]=[];let embeddingRequests=0;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=String(input);
 if(url.includes('/v1/embeddings')){embeddingRequests++;const body=JSON.parse(String(init?.body));return Response.json({data:body.input.map((_:string,index:number)=>({index,embedding:[1,0]}))})}
 if(url.includes('qdrant.test')){if(url.includes('/points/search'))return Response.json({result:[{score:1,vector:[1,0],payload:points[0].payload}]});if(url.includes('/points?'))points.push(...JSON.parse(String(init?.body)).points);return Response.json({result:true})}
 if(url.includes('.freshdesk.com')){return Response.json(url.includes('/articles')?[{id:3,title:'Freshdesk Imported',description:'<p>FD</p>',status:2}]:url.includes('/folders')?[{id:2,name:'Folder',visibility:1}]:[{id:1,name:'FD Category'}])}
 if(url.includes('.zendesk.com')){return Response.json(url.includes('/articles')?{articles:[{id:3,title:'Zendesk Imported',body:'<p>ZD</p>',section_id:2,draft:false}]}:url.includes('/sections')?{sections:[{id:2,name:'ZD Section',category_id:1}]}:{categories:[{id:1,name:'ZD Category'}]})}
 if(url.includes('api.intercom.io')){const data=url.includes('/collections')?[{id:'1',name:'Collection',description:'Summary'}]:url.includes('/sections')?[{id:'2',parent_id:'1',name:'Section'}]:[{id:'3',parent_type:'section',parent_id:'2',title:'Imported',body:'<p>Imported <strong>body</strong></p>',state:'published'}];return Response.json({data,pages:{page:1,total_pages:1}})}
 throw new Error(`Unexpected provider fixture URL ${url}`)
 }) as typeof fetch;
 try{
 const semanticEnv={...testing,OPENAI_API_KEY:'test-only',KNOWLEDGE_EMBEDDING_MODEL:'test-only',QDRANT_URL:'https://qdrant.test',QDRANT_API_KEY:'test-only',INTERCOM_TOKEN:'test-only',FRESHDESK_TOKEN:'test-only',ZENDESK_TOKEN:'test-only',ZENDESK_EMAIL:'test@example.com'};
 await refreshDataset(semanticEnv,'p','dataset',{documents,semantic:true});while(jobs.length)await consumeJob(jobs.shift()!,semanticEnv);
 check(points.length>256,'semantic ingestion must exceed former 256 chunk ceiling');check(embeddingRequests>1,'embedding work paged');
 check((await searchKnowledge(semanticEnv,'p','Corpus','semantic')).length===1,'native semantic MMR per-collection retrieval');
 await queueImport(semanticEnv,'p','intercom');while(jobs.length)await consumeJob(jobs.shift()!,semanticEnv);await queueImport(semanticEnv,'p','intercom');while(jobs.length)await consumeJob(jobs.shift()!,semanticEnv);
 check((await env.DB.prepare("SELECT count(*) n FROM knowledge_articles WHERE title='Imported'").first<{n:number}>())?.n===1,'native import repeat identity');
 check((await env.DB.prepare("SELECT content FROM knowledge_articles WHERE title='Imported'").first<{content:string}>())?.content==='Imported **body**','native import content');
 await queueImport(semanticEnv,'p','freshdesk','example');while(jobs.length)await consumeJob(jobs.shift()!,semanticEnv);check(!!await env.DB.prepare("SELECT id FROM knowledge_articles WHERE title='Freshdesk Imported'").first(),'native Freshdesk hierarchy import');
 await queueImport(semanticEnv,'p','zendesk','example');while(jobs.length)await consumeJob(jobs.shift()!,semanticEnv);check(!!await env.DB.prepare("SELECT id FROM knowledge_articles WHERE title='Zendesk Imported'").first(),'native Zendesk hierarchy import');
 }finally{globalThis.fetch=actualFetch}
 await testKnowledgeRecovery(env,check)
 await env.DB.prepare("INSERT INTO project_settings VALUES('p',json_object('deleted_at',123),123) ON CONFLICT(project_id) DO UPDATE SET settings_json=excluded.settings_json").run()
 for(const path of ['/public/p/articles','/public/p/categories','/public/p/search?q=Imported','/public/p/articles/published'])check((await routes.request(path,{},env)).status===404,'deleted project public knowledge denied')
 await testDeletedKnowledgeProjects(env,check);
 return Response.json({passed:checks,runtime:'workerd',database:'real local D1',storage:'real local R2',providerCalls:0})
 }catch(error){return Response.json({error:String(error),checks},{status:500})}
}}
