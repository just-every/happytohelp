import {emailAddress} from './inbound-routing'
import type {HeaderEntry} from './email-classification'

/**
 * Who wrote an inbound email. The header From is the sender's identity; it is
 * verified when the receiving provider reports DKIM aligned with the From domain,
 * DMARC passing for it, or SPF passing for an aligned envelope domain. The SMTP
 * envelope sender (rewritten by VERP and forwarding SRS) is delivery metadata only,
 * and Reply-To is only ever a reply target.
 */
const domainOf=(value:unknown)=>emailAddress(value)?.split('@')[1]||null
/** Relaxed alignment without a public suffix list: equal, or one a subdomain of the other. */
export function alignedDomain(left:string|null|undefined,right:string|null|undefined){
 const a=String(left||'').trim().toLowerCase().replace(/\.$/,''),b=String(right||'').trim().toLowerCase().replace(/\.$/,'')
 return Boolean(a&&b&&a.includes('.')&&b.includes('.')&&(a===b||a.endsWith('.'+b)||b.endsWith('.'+a)))
}

// Cloudflare Email Routing prepends its own verdict; a message's copies further
// down were written by the sender or an earlier hop and are never trusted.
export const CLOUDFLARE_AUTHSERV='mx.cloudflare.net'
type Verdict={method:string;result:string;properties:Record<string,string>}
function verdicts(value:string):{authserv:string;results:Verdict[]}{
 let text=value
 for(let previous='';previous!==text;){previous=text;text=text.replace(/\([^()]*\)/g,' ')}
 const [authserv='',...parts]=text.split(';')
 return {authserv:authserv.trim().split(/\s+/)[0].toLowerCase(),results:parts.map(part=>{
  const match=part.trim().match(/^([a-z-]+)\s*=\s*([a-z]+)\b(.*)$/i)
  if(!match)return null
  const properties:Record<string,string>={}
  for(const property of match[3].matchAll(/([a-z]+\.[a-z-]+)\s*=\s*("[^"]*"|[^\s;]+)/gi))properties[property[1].toLowerCase()]=property[2].replace(/^"|"$/g,'')
  return {method:match[1].toLowerCase(),result:match[2].toLowerCase(),properties}
 }).filter((entry):entry is Verdict=>entry!==null)}
}
export function verifiedByAuthenticationResults(headers:Iterable<HeaderEntry>,from:string,authserv=CLOUDFLARE_AUTHSERV){
 const fromDomain=domainOf(from)
 if(!fromDomain)return false
 const top=[...headers].find(header=>typeof header?.key==='string'&&header.key.trim().toLowerCase()==='authentication-results')
 if(!top||typeof top.value!=='string')return false
 const parsed=verdicts(top.value)
 if(parsed.authserv!==authserv)return false
 return parsed.results.some(({method,result,properties})=>result==='pass'&&(
  method==='dmarc'&&alignedDomain(properties['header.from'],fromDomain)||
  method==='dkim'&&alignedDomain(properties['header.d']||domainOf(properties['header.i']),fromDomain)||
  method==='spf'&&alignedDomain(domainOf(properties['smtp.mailfrom'])||properties['smtp.mailfrom'],fromDomain)))
}

/** SendGrid Inbound Parse reports `dkim` as `{@domain : pass, ...}` and `SPF` for the envelope sender. */
export function verifiedBySendGrid(input:{dkim:string;spf:string;envelopeFrom:string;from:string}){
 const fromDomain=domainOf(input.from)
 if(!fromDomain)return false
 for(const match of input.dkim.matchAll(/@([^\s:,{}]+)\s*:\s*([a-z]+)/gi))if(match[2].toLowerCase()==='pass'&&alignedDomain(match[1],fromDomain))return true
 return input.spf.trim().toLowerCase()==='pass'&&alignedDomain(domainOf(input.envelopeFrom),fromDomain)
}

// Addresses a forwarder or the receiving server recorded for the original recipient.
const FORWARDING_HEADERS=['delivered-to','x-original-to','x-forwarded-to','x-gm-original-to']
const addresses=(value:unknown)=>typeof value==='string'?value.split(',').map(entry=>emailAddress(entry)).filter((entry):entry is string=>Boolean(entry)):[]
export function forwardingAddresses(headers:Iterable<HeaderEntry>){
 const found:string[]=[]
 for(const header of headers)if(typeof header?.key==='string'&&FORWARDING_HEADERS.includes(header.key.trim().toLowerCase()))found.push(...addresses(header.value))
 return [...new Set(found)]
}
/** The envelope recipient routes first; forwarding headers, then To and Cc, find the
 * project only when the envelope names no configured mailbox. */
export function routingCandidates(input:{envelope:readonly unknown[];headers:Iterable<HeaderEntry>;to?:readonly unknown[];cc?:readonly unknown[]}){
 const headers=[...input.headers]
 return [...new Set([...input.envelope.map(emailAddress),...forwardingAddresses(headers),...(input.to||[]).map(emailAddress),...(input.cc||[]).map(emailAddress)].filter((entry):entry is string=>Boolean(entry)))]
}
