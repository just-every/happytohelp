import type {Env} from '../../../platform/env'
import {hashToken} from '../../../platform/auth'
import {sendEmail} from '../../integrations/email'
import {emailAddress} from '../../integrations/inbound-routing'
import {checkSenderDomain} from '../../integrations/sender-domain'
import type {Configuration} from './configuration'
import type {Probe} from './types'
import {providerJson,bearer} from './provider-http'

const mailReady=(config:Configuration):Probe|null=>!config.sender?{state:'pending',detail:'Save a sender email address in Email settings.'}:!config.providerName?{state:'unavailable',detail:'Select an email provider in installation settings.'}:null
// Repeated clicks and lost HTTP responses retain one command per sender/account/owner identity.
export async function testMailIdentity(config:Configuration,ownerId:string) {
 const owner=config.owners.find(row=>row.id===ownerId)
 if(!owner)return null
 return {owner,id:`activation:${await hashToken(JSON.stringify([config.projectId,config.fingerprints.owner_mail,owner.id,owner.email]))}`}
}
export async function sendOwnerTestMail(env:Env,config:Configuration,ownerId:string):Promise<Probe> {
 const identity=await testMailIdentity(config,ownerId)
 if(!identity)return {state:'unavailable',detail:'Only a workspace owner can send a test to their own mailbox.'}
 const existing=await env.DB.prepare('SELECT state FROM email_deliveries WHERE id=? AND project_id=?').bind(identity.id,config.projectId).first()
 if(existing)return checkOwnerMail(env,config,ownerId)
 if(!env.EMAIL_API_KEY||!env.EMAIL_FROM)return {state:'unavailable',detail:'CONFIGURATION_REQUIRED: EMAIL_API_KEY and EMAIL_FROM. Add email secrets to the installation.'}
 const problem=mailReady(config);if(problem)return problem
 try {
  await sendEmail(env,{projectId:config.projectId,to:identity.owner.email,idempotencyKey:identity.id,subject:'HappyToHelp activation test',text:'This is your HappyToHelp activation test. Delivery is confirmed separately using provider status.',headers:{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'}})
 } catch { /* The durable delivery record distinguishes rejection from uncertainty. Never replay. */ }
 return checkOwnerMail(env,config,ownerId)
}
/** Resend GET status is authoritative for this message identity, not the send acceptance.
 * https://resend.com/docs/api-reference/emails/retrieve-email */
export async function checkOwnerMail(env:Env,config:Configuration,ownerId?:string):Promise<Probe> {
 const ready=mailReady(config);if(ready)return ready
 if(!env.EMAIL_API_KEY)return {state:'unavailable',detail:'CONFIGURATION_REQUIRED: EMAIL_API_KEY. Install the selected email provider key.'}
 const identities=await Promise.all(config.owners.filter(owner=>!ownerId||owner.id===ownerId).map(owner=>testMailIdentity(config,owner.id)))
 let delivery:any=null
 for(const identity of identities) {
  const row=identity&&await env.DB.prepare('SELECT * FROM email_deliveries WHERE id=? AND project_id=? AND recipient=?').bind(identity.id,config.projectId,identity.owner.email).first<any>()
  if(row&&(!delivery||row.created_at>delivery.created_at))delivery=row
 }
 if(!delivery)return {state:'pending',detail:'Send one test message to your owner mailbox, then check its delivery status.'}
 if(delivery.state==='failed')return {state:'failed',detail:'The provider rejected this test message. Review the provider log; it will not be sent again automatically.',receiptRef:delivery.id}
 if(delivery.state==='uncertain'||delivery.state==='sending')return {state:'unknown',detail:'The test send outcome is unknown. Reconcile it with the provider; do not resend.',receiptRef:delivery.id}
 if(config.providerName!=='resend')return {state:'unavailable',detail:`${config.providerName} accepted the test, but this installation cannot retrieve its authoritative delivery event. Provider status access is required.`,receiptRef:delivery.id}
 if(!delivery.provider_id)return {state:'unknown',detail:'The provider did not retain a message ID for delivery lookup.',receiptRef:delivery.id}
 const body=await providerJson(`https://api.resend.com/emails/${encodeURIComponent(delivery.provider_id)}`,bearer(env.EMAIL_API_KEY))
 if(body.id!==delivery.provider_id||emailAddress(body.from)!==config.sender||!Array.isArray(body.to)||body.to.length!==1||emailAddress(body.to[0])!==delivery.recipient.toLowerCase())return {state:'unknown',detail:'Provider status did not match the test message, sender and owner recipient.',receiptRef:delivery.id}
 const event=body.last_event
 if(event==='delivered')return {state:'done',detail:'The provider confirmed delivery to the owner mailbox server.',receiptRef:`resend:${delivery.provider_id}:delivered`}
 if(['bounced','failed','suppressed'].includes(event))return {state:'failed',detail:`The provider reported ${event} for this test message.`,receiptRef:`resend:${delivery.provider_id}:${event}`}
 return {state:['sent','queued','scheduled','delivery_delayed'].includes(event)?'pending':'unknown',detail:'The provider has not supplied an authoritative delivered event. Sending or queue acceptance does not complete this step.',receiptRef:delivery.id}
}
/** https://resend.com/docs/api-reference/domains/list-domains
 * https://resend.com/docs/api-reference/domains/get-domain */
export async function checkSenderDns(env:Env,config:Configuration):Promise<Probe> {
 const ready=mailReady(config);if(ready)return ready
 if(!env.EMAIL_API_KEY)return {state:'unavailable',detail:'CONFIGURATION_REQUIRED: EMAIL_API_KEY. Install a provider key with domain read permission.'}
 if(config.providerName!=='resend')return {state:'unavailable',detail:`${config.providerName} domain verification is not available through this adapter. A supported authoritative domain-status API is required.`}
 const domain=config.sender!.split('@')[1]
 const list=await providerJson('https://api.resend.com/domains',bearer(env.EMAIL_API_KEY))
 if(!Array.isArray(list.data))return {state:'unknown',detail:'Provider omitted its domain list.'}
 const found=list.data.find((row:any)=>typeof row?.name==='string'&&row.name.toLowerCase()===domain)
 if(!found?.id)return {state:list.has_more?'unavailable':'pending',detail:list.has_more?'The sending domain is not in the returned page. Domain status access for this domain is required.':`Add and verify ${domain} in your email provider, then check again.`}
 const body=await providerJson(`https://api.resend.com/domains/${encodeURIComponent(found.id)}`,bearer(env.EMAIL_API_KEY))
 if(body.id!==found.id||body.name?.toLowerCase()!==domain||!Array.isArray(body.records))return {state:'unknown',detail:'Provider omitted the expected domain or DNS records.'}
 const records=body.records.filter((record:any)=>['SPF','DKIM'].includes(record.record))
 const valid=body.status==='verified'&&records.some((r:any)=>r.record==='SPF')&&records.some((r:any)=>r.record==='DKIM')&&records.every((r:any)=>r.status==='verified')
 if(valid){
  const dns=await checkSenderDomain(domain)
  if(!dns.ok)return {state:dns.records.some(record=>record.status==='unknown')?'unknown':'pending',detail:dns.records.filter(record=>record.status!=='present').map(record=>record.message).join('. ')}
 }
 return {state:valid?'done':body.status==='failed'?'failed':'pending',detail:valid?`Provider verified ${domain} and its required SPF/DKIM DNS records.`:`${domain} DNS is not fully verified. Review SPF/DKIM records in the provider and allow propagation.`,receiptRef:`resend:domain:${body.id}`}
}
