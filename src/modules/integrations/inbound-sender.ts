import {emailAddress} from './inbound-routing'
import type {HeaderEntry} from './email-classification'
import {cloudflareConsistent,parseAuthenticationResults} from './authentication-results'

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
/** `verified`: an aligned pass for the From domain. `failed`: the provider reported
 * a DKIM, SPF or DMARC fail, or its verdict is ambiguous, so the From may be forged. */
export type SenderVerdict={verified:boolean;failed:boolean}
const AUTHENTICATED=new Set(['dkim','spf','dmarc'])
const sameEnvelope=(value:string|undefined,envelopeFrom:string)=>{
 const envelope=emailAddress(envelopeFrom),identity=String(value||'').toLowerCase()
 return Boolean(envelope&&identity&&(identity.includes('@')?identity===envelope:identity===envelope.split('@')[1]))
}
/** SPF passes only for the MAIL FROM the provider received (`envelopeFrom`), so a
 * verdict naming any other envelope identity never verifies the From. */
export function authenticationVerdict(headers:Iterable<HeaderEntry>,from:string,envelopeFrom:string,authserv=CLOUDFLARE_AUTHSERV):SenderVerdict{
 const fromDomain=domainOf(from)
 const top=[...headers].find(header=>typeof header?.key==='string'&&header.key.trim().toLowerCase()==='authentication-results')
 if(!fromDomain||!top||typeof top.value!=='string'||top.value.trim().split(/[\s;(]/)[0].toLowerCase()!==authserv)return {verified:false,failed:false}
 const parsed=parseAuthenticationResults(top.value)
 if(!parsed||parsed.authserv!==authserv||!cloudflareConsistent(parsed.results))return {verified:false,failed:true}
 const verified=parsed.results.some(({method,result,properties})=>result==='pass'&&(
  method==='dmarc'&&alignedDomain(properties['header.from'],fromDomain)||
  method==='dkim'&&alignedDomain(properties['header.d']||domainOf(properties['header.i']),fromDomain)||
  method==='spf'&&sameEnvelope(properties['smtp.mailfrom'],envelopeFrom)&&alignedDomain(domainOf(properties['smtp.mailfrom'])||properties['smtp.mailfrom'],fromDomain)))
 return {verified,failed:!verified&&parsed.results.some(({method,result})=>AUTHENTICATED.has(method)&&result==='fail')}
}

/** SendGrid Inbound Parse reports `dkim` as `{@domain : pass, ...}` and `SPF` for the envelope sender. */
export function sendGridVerdict(input:{dkim:string;spf:string;envelopeFrom:string;from:string}):SenderVerdict{
 const fromDomain=domainOf(input.from),spf=input.spf.trim().toLowerCase()
 if(!fromDomain)return {verified:false,failed:false}
 for(const match of input.dkim.matchAll(/@([^\s:,{}]+)\s*:\s*([a-z]+)/gi))if(match[2].toLowerCase()==='pass'&&alignedDomain(match[1],fromDomain))return {verified:true,failed:false}
 const verified=spf==='pass'&&alignedDomain(domainOf(input.envelopeFrom),fromDomain)
 return {verified,failed:!verified&&spf==='fail'}
}

// Addresses a forwarder or the receiving server recorded for the original recipient.
const FORWARDING_HEADERS=['delivered-to','x-original-to','x-forwarded-to','x-gm-original-to']
const addresses=(value:unknown)=>typeof value==='string'?value.split(',').map(entry=>emailAddress(entry)).filter((entry):entry is string=>Boolean(entry)):[]
export function forwardingAddresses(headers:Iterable<HeaderEntry>){
 const found:string[]=[]
 for(const header of headers)if(typeof header?.key==='string'&&FORWARDING_HEADERS.includes(header.key.trim().toLowerCase()))found.push(...addresses(header.value))
 return [...new Set(found)]
}
/** At most this many addresses are looked up to find the receiving mailbox. */
export const MAX_ROUTING_CANDIDATES=50
/** The envelope recipient routes first; forwarding headers, then To and Cc, find the
 * project only when the envelope names no configured mailbox. Addresses on a domain
 * we received on come before other recipients, and a long reply-all is cut to
 * MAX_ROUTING_CANDIDATES rather than refused. */
export function routingCandidates(input:{envelope:readonly unknown[];headers:Iterable<HeaderEntry>;to?:readonly unknown[];cc?:readonly unknown[]}){
 const envelope=routingAddresses(input.envelope),receiving=new Set(envelope.map(address=>address.split('@')[1])),listed=valid([...(input.to||[]),...(input.cc||[])])
 return routingAddresses([...envelope,...forwardingAddresses(input.headers),...listed.filter(address=>receiving.has(address.split('@')[1])),...listed])
}
const valid=(values:readonly unknown[])=>values.map(value=>typeof value==='string'&&value.length<=320?emailAddress(value):null).filter((entry):entry is string=>Boolean(entry))
/** Valid recipient addresses in routing order, deduplicated and bounded. Malformed,
 * over-long and excess entries are skipped; a long reply-all is never refused. */
export function routingAddresses(values:readonly unknown[]){return [...new Set(valid(values))].slice(0,MAX_ROUTING_CANDIDATES)}
