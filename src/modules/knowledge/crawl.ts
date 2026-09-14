import type { Env } from '../../platform/env'
export interface CrawlConfig {url:string;excluded_urls?:string[];max_crawl_depth?:number;max_crawl_pages?:number}
export async function startCrawl(env:Env,input:CrawlConfig){
 if(typeof env.APIFY_TOKEN!=='string'||typeof env.APIFY_CRAWLER_ACTOR_ID!=='string')throw new Error('CONFIGURATION_INVALID: APIFY_TOKEN and APIFY_CRAWLER_ACTOR_ID required');
 const url=new URL(input.url);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid crawl URL');
 const response=await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(env.APIFY_CRAWLER_ACTOR_ID)}/runs`,{method:'POST',headers:{Authorization:`Bearer ${env.APIFY_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({startUrls:[{url:url.href}],excludeUrlGlobs:(input.excluded_urls||[]).map(glob=>({glob})),maxCrawlDepth:input.max_crawl_depth??3,maxCrawlPages:input.max_crawl_pages??100})});
 if(!response.ok)throw new Error(`Crawler start failed (${response.status})`);const result=await response.json<any>();return {runId:result.data.id,datasetId:result.data.defaultDatasetId}
}
export async function crawlStatus(env:Env,runId:string){
 if(typeof env.APIFY_TOKEN!=='string')throw new Error('CONFIGURATION_INVALID: APIFY_TOKEN required');const response=await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,{headers:{Authorization:`Bearer ${env.APIFY_TOKEN}`}});if(!response.ok)throw new Error(`Crawler status failed (${response.status})`);return (await response.json<any>()).data as {status:string;defaultDatasetId:string}
}
