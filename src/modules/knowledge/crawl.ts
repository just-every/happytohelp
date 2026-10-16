import type { Env } from '../../platform/env'
import {crawlLimitError} from './crawl-limits'
export interface CrawlConfig {url:string;excluded_urls?:string[];max_crawl_depth?:number;max_crawl_pages?:number}
/** The two installation settings of the crawler service (Apify) that larger website sources use. */
export const CRAWLER_SETTINGS=['APIFY_TOKEN','APIFY_CRAWLER_ACTOR_ID'] as const
const isSet=(env:Env,name:string)=>typeof env[name]==='string'&&!!env[name]
/** Which reader website sources use: the crawler once either crawler setting is present, otherwise the built-in reader. */
export function websiteReader(env:Env){
 const settings=CRAWLER_SETTINGS.map(name=>({name,set:isSet(env,name)}))
 return {reader:settings.some(setting=>setting.set)?'crawler' as const:'built-in' as const,settings}
}
/** A crawler that is half set up, named in words: which setting is missing and where the steps are. */
export function crawlerSetupProblem(env:Env){
 const missing=CRAWLER_SETTINGS.filter(name=>!isSet(env,name))
 if(!missing.length||missing.length===CRAWLER_SETTINGS.length)return null
 const present=CRAWLER_SETTINGS.filter(name=>isSet(env,name))
 return `The crawler service is only half set up: ${present.join(' and ')} is set but ${missing.join(' and ')} is not. Add ${missing.join(' and ')} (the steps are under “Larger sites: the crawler service” on Knowledge, Website sources, and at /docs/website-knowledge), or remove ${present.join(' and ')} so HappyToHelp reads the pages itself.`
}
export async function startCrawl(env:Env,input:CrawlConfig){
 const problem=crawlerSetupProblem(env);if(problem)throw new Error(problem);
 const url=new URL(input.url);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid crawl URL');const limitError=crawlLimitError(input);if(limitError)throw new Error(limitError);
 const response=await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(String(env.APIFY_CRAWLER_ACTOR_ID))}/runs`,{method:'POST',headers:{Authorization:`Bearer ${env.APIFY_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({startUrls:[{url:url.href}],excludeUrlGlobs:(input.excluded_urls||[]).map(glob=>({glob})),maxCrawlDepth:input.max_crawl_depth??3,maxCrawlPages:input.max_crawl_pages??100})});
 if(!response.ok)throw new Error(`Crawler start failed (${response.status})`);const result=await response.json<any>();return {runId:result.data.id,datasetId:result.data.defaultDatasetId}
}
export async function crawlStatus(env:Env,runId:string){
 if(!isSet(env,'APIFY_TOKEN'))throw new Error('The crawler service setting APIFY_TOKEN was removed while this website was being crawled. Add it again, or choose Refresh now to read the pages with the built-in reader.');const response=await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}`,{headers:{Authorization:`Bearer ${env.APIFY_TOKEN}`}});if(!response.ok)throw new Error(`Crawler status failed (${response.status})`);return (await response.json<any>()).data as {status:string;defaultDatasetId:string}
}
