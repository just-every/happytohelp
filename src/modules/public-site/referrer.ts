import sources from './referrer-sources.json' with {type:'json'}
import context from './referrer-context.json' with {type:'json'}
import messages from './referrer-messages.json' with {type:'json'}
const data={...sources,...context,...messages}
import { escapeHtml } from './html'
export interface TrafficSource {source_name:string;audience:string;formatted_source:string;source:string;is_paid:boolean;business_size:string;intent:string;industry:string|null}
type Parameters=Record<string,string>
const upper=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1)
const detect=(text:string,mapping:Record<string,string[]>)=>Object.entries(mapping).find(([,words])=>words.some(word=>text.toLowerCase().includes(word)))?.[0]||null
function utm(params:Parameters){const source=params.utm_source.toLowerCase(),paid=['cpc','ppc','paid','display','ad','ads','social-paid','paid-social','email'].includes((params.utm_medium||'').toLowerCase());const entry=data.sources.find(entry=>entry.match.includes(source)||entry.contains.some(part=>source.includes(part)));return entry?{...entry.result,is_paid:'is_paid' in entry.result?entry.result.is_paid:paid}:{source_name:upper(source),audience:'businesses',formatted_source:upper(source),source:'unknown_utm_'+source,is_paid:paid}}
export function analyzeTrafficSource(params:Parameters,referrer:string|null=null):TrafficSource{
 let result:any=null
 if(params.utm_source)result=utm(params)
 if(!result)for(const [key,value]of Object.entries({...data.trackingParams,...data.extraTracking}))if(params[key]){result={...value,is_paid:true};break}
 if(!result&&params.ref){const ref=params.ref.toLowerCase();result=Object.values(data.refSources).find(entry=>entry.matches.includes(ref))?.result}
 if(!result&&params.source)result=utm({utm_source:params.source})
 if(!result&&referrer){let domain='';try{domain=new URL(referrer).hostname.toLowerCase()}catch{}if(domain)result=Object.entries(data.domainMappings).find(([known])=>domain===known||domain.includes(known)||known.includes(domain))?.[1]}
 result={source_name:'',audience:'your website',formatted_source:'',source:'',is_paid:false,...result,business_size:'SMB',intent:'exploring',industry:null}
 const campaign=(params.utm_campaign||'').toLowerCase()
 if(campaign){if(/enterprise|large/.test(campaign))result.business_size='Enterprise';else if(/startup|founder/.test(campaign))result.business_size='Startup';else if(/smb|small/.test(campaign))result.business_size='SMB';if(/demo|trial/.test(campaign))result.intent='evaluating';else if(/buy|purchase/.test(campaign))result.intent='purchasing';else if(/learn|guide/.test(campaign))result.intent='learning';else if(/compare|vs/.test(campaign))result.intent='comparing';result.industry=detect(campaign,data.industries)}
 if(params.utm_term){result.industry ||= detect(params.utm_term,data.industries);result.intent=detect(params.utm_term,data.intentPatterns)||result.intent}
 const query=params.q||params.query||params.s||params.search
 if(query){const industry=detect(query,data.industries);if(industry){result.industry=industry;result.audience=industry+' owners'}result.intent=detect(query,data.intentPatterns)||result.intent}
 return result
}
export function generateVisitorMessages(source:TrafficSource,context:{query?:string;country?:string;userAgent?:string;hour?:number}={},random:()=>number=Math.random){
 const messages:[string,number][]=[];const append=(rows:unknown)=>messages.push(...rows as [string,number][])
 if(source.industry)append([[`${upper(source.industry)} Decision Maker`,90],[`${upper(source.industry)} Tech Researcher`,85]])
 let key=source.source
 if(source.is_paid){key=['google','facebook','instagram','linkedin','twitter','x_ads','tiktok','youtube','reddit','email'].find(part=>source.source.includes(part))||'other';append(data.trafficMessages[`paid:${key}` as keyof typeof data.trafficMessages]);if(context.query)messages.push([`Searched for: ${context.query}`,98])}
 else if(source.source!=='generic'){const rows=data.trafficMessages[`organic:${key}` as keyof typeof data.trafficMessages]||data.trafficMessages['organic:other'];append(rows.map(([text,priority])=>[String(text).replace('__SOURCE_NAME__',source.source_name),priority]));if(key==='google'&&context.query)messages.push([`Searched: ${context.query}`,85])}
 append(data.intentMessages[source.intent as keyof typeof data.intentMessages]||data.intentMessages.exploring);append(data.sizeMessages[source.business_size as keyof typeof data.sizeMessages]||[])
 if(context.country)messages.push([data.countryContexts[context.country as keyof typeof data.countryContexts]||`${context.country}-Based Business`,60])
 const pick=(values:string[],priority:number)=>{const pool=[...values];for(let n=0;n<2&&pool.length;n++)messages.push([pool.splice(Math.floor(random()*pool.length),1)[0],priority])}
 pick(data.businessContexts,50);if(source.industry&&source.industry in data.industryGoals)pick(data.industryGoals[source.industry as keyof typeof data.industryGoals],65)
 const hour=context.hour??new Date().getUTCHours();messages.push([/mobile|android|touch|tablet|ipad|phone/i.test(context.userAgent||'')?'On Mobile Device':hour>=9&&hour<=17?'During Business Hours':hour>=18?'After Work Hours':'Early Morning Browser',40])
 return messages.sort((a,b)=>b[1]-a[1]).slice(0,10).map(([text])=>text)
}
export function personalizeHome(html:string,request:Request){const url=new URL(request.url),params=Object.fromEntries([...url.searchParams].map(([key,value])=>[key,value.slice(0,500)])),source=analyzeTrafficSource(params,request.headers.get('referer'));const messages=generateVisitorMessages(source,{query:params.q||params.query||params.s||params.search,country:request.headers.get('cf-ipcountry')||undefined,userAgent:request.headers.get('user-agent')||''});return html.replace(/We help maximise the potential of your website\./,`We help maximise the potential of ${escapeHtml(source.audience)}${source.formatted_source?' on '+escapeHtml(source.formatted_source):''}.`).replace(/window.visitorMessages = .*?;/,`window.visitorMessages = ${JSON.stringify(messages).replaceAll('<','\\u003c')};`)}
