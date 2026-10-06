// Bounds for website crawls. The dashboard form and the HTTP routes enforce the same limits, and the crawler
// start re-checks them so a record stored before the limits existed is refused instead of sent to the provider.
export interface CrawlBounds {min:number;max:number}
export const CRAWL_DEPTH:CrawlBounds={min:0,max:100}
export const CRAWL_PAGES:CrawlBounds={min:1,max:10000}
const range=(label:string,bounds:CrawlBounds)=>`${label} must be a whole number from ${bounds.min.toLocaleString('en-US')} to ${bounds.max.toLocaleString('en-US')}`
function check(value:unknown,label:string,bounds:CrawlBounds,required:boolean):string|null{
 if(value===''||(required&&(value===undefined||value===null)))return `${label} is required: enter a whole number from ${bounds.min.toLocaleString('en-US')} to ${bounds.max.toLocaleString('en-US')}`
 if(value===undefined||value===null)return null
 return typeof value==='number'&&Number.isInteger(value)&&value>=bounds.min&&value<=bounds.max?null:range(label,bounds)
}
export const crawlDepthError=(value:unknown,required=false)=>check(value,'Max crawl depth',CRAWL_DEPTH,required)
export const crawlPagesError=(value:unknown,required=false)=>check(value,'Max crawl pages',CRAWL_PAGES,required)
/** First problem with the crawl limits of a dataset body; absent values mean the stored or default limits apply. */
export const crawlLimitError=(input:{max_crawl_depth?:unknown;max_crawl_pages?:unknown})=>crawlDepthError(input.max_crawl_depth)??crawlPagesError(input.max_crawl_pages)
