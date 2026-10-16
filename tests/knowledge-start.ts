import type {Env,Job} from '../src/platform/env'
import {routes} from '../src/modules/knowledge/routes'
import {consumeJob,refreshDueDatasets,searchKnowledge} from '../src/modules/knowledge/service'

/** Public authoring routes, real D1/R2 and queue/provider boundary fixtures. */
export async function testKnowledgeStart(env:Env,check:(condition:unknown,message:string)=>void){
 const jobs:Job[]=[];const starts:any[]=[];let rejectStart=false;
 const testing={...env,APIFY_TOKEN:'test-only',APIFY_CRAWLER_ACTOR_ID:'selected-test-actor',JOBS:{send:async(job:Job)=>{jobs.push(job)}}} as unknown as Env;
 const send=(path:string,body:unknown,bindings=testing)=>routes.request(path,{method:'POST',headers:{Authorization:'Bearer owner-test','Content-Type':'application/json'},body:JSON.stringify(body)},bindings);
 const read=async(id:string)=>(await routes.request(`/p/datasets/${id}`,{headers:{Authorization:'Bearer owner-test'}},testing)).json<any>();
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));
  if(url.host!=='api.apify.com')throw new Error('Unexpected provider host');
  if(init?.method==='POST'){
   check(url.pathname==='/v2/acts/selected-test-actor/runs','initial crawl uses the configured actor');
   starts.push(JSON.parse(String(init.body)));
   if(rejectStart)throw new Error('Injected uncertain crawler start');
   return Response.json({data:{id:'test-run',defaultDatasetId:'test-corpus'}})
  }
  if(url.pathname==='/v2/actor-runs/test-run')return Response.json({data:{status:'SUCCEEDED',defaultDatasetId:'test-corpus'}});
  if(url.pathname==='/v2/datasets/test-corpus/items')return Response.json([{url:'https://crawl.example.test/guide',title:'Initial crawl',text:'Initialcrawlmarker retained support instructions'}]);
  throw new Error('Unexpected provider path')
 }) as typeof fetch;
 try{
  for(const mode of ['manual','adaptive']){
   const settings={url:`https://crawl.example.test/${mode}`,excluded_urls:['https://crawl.example.test/private/**'],max_crawl_depth:2,max_crawl_pages:7,refreshMode:mode};
   const response=await send('/p/datasets',settings);check(response.status===201,'Add URL creates a source');
   const created=await response.json<any>();
   check(created.refresh?.status==='queued'&&jobs.some(job=>job.id===created.refresh.id),'Add URL immediately dispatches its first refresh in either recurrence mode');
   const initial=await read(created.id);check(initial.status==='ingesting'&&!!initial.source_input,'initial source retains its recoverable input and progress');
   const attemptsBeforeStart=starts.length;const first=jobs.shift()!;await consumeJob(first,testing);await consumeJob(first,testing);
   check(starts.length===attemptsBeforeStart+1,'duplicate initial delivery starts the provider only once');
   check((await read(created.id)).status==='crawling','source exposes running crawl progress');
   const submitted=starts.at(-1);
   check(submitted.startUrls[0].url===settings.url&&JSON.stringify(submitted.excludeUrlGlobs)===JSON.stringify(settings.excluded_urls.map(glob=>({glob})))&&submitted.maxCrawlDepth===settings.max_crawl_depth&&submitted.maxCrawlPages===settings.max_crawl_pages,'initial crawl carries the saved URL, exclusions, depth and page bounds');
   while(jobs.length){const job=jobs.shift()!;await consumeJob(job,testing);await consumeJob(job,testing)}
   const ready=await read(created.id);
   check(ready.status==='ready'&&ready.page_count===1&&!!ready.published_version,'initial crawl publishes and exposes indexed pages without manual refresh');
   check(mode==='manual'?ready.next_refresh_at===null:ready.next_refresh_at>Date.now(),'recurrence mode governs later refreshes only');
   check((await searchKnowledge(testing,'p','Initialcrawlmarker')).some(citation=>citation.url==='https://crawl.example.test/guide'),'newly added website enters real retrieval');
   if(mode==='adaptive'){
    rejectStart=true;
    const refresh=await send(`/p/datasets/${created.id}/crawl`,{});check(refresh.status===202,'explicit refresh enters the same guarded crawl path');
    const attempt=jobs.shift()!;await consumeJob(attempt,testing);await consumeJob(attempt,testing);
    const failed=await read(created.id);const attempts=starts.length;
    await refreshDueDatasets(testing);
    check(failed.status==='failed'&&failed.published_version===ready.published_version&&failed.next_refresh_at===null,'failed website refresh preserves the last usable corpus and stops recurrence');
    check(starts.length===attempts&&!jobs.length,'an uncertain provider start is never automatically replayed');
    check((await searchKnowledge(testing,'p','Initialcrawlmarker')).some(citation=>citation.sourceVersion===ready.published_version),'failed refresh leaves published website content retrievable');
   }
   const removed=await routes.request(`/p/datasets/${created.id}`,{method:'DELETE',headers:{Authorization:'Bearer owner-test'}},testing);
   check(removed.status===200,'website test source is removable after terminal refresh');
  }
  const attempts=starts.length;
  check((await send('/p/datasets',{url:'javascript:invalid'})).status===400,'invalid website URL is refused before initial dispatch');
  check((await send('/p/datasets',{url:'https://crawl.example.test',excluded_urls:'private'})).status===400,'invalid exclusions are refused before initial dispatch');
  check((await send('/p/datasets',{url:'https://crawl.example.test',max_crawl_pages:0})).status===400,'invalid crawl bounds are refused before initial dispatch');
  check((await send('/other/datasets',{url:'https://crawl.example.test'})).status===403&&starts.length===attempts,'another workspace cannot start a crawl');
 }finally{globalThis.fetch=originalFetch}
}
