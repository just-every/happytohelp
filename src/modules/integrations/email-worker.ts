import {plainEmail} from './email-reply'
import {HTTPException} from 'hono/http-exception'
import PostalMime from 'postal-mime'
import type {Env} from '../../platform/env'
import {receiveEmail} from './inbound-service'
import {hashToken} from '../../platform/auth'
import {scheduleInboundEffects} from './inbound-effects'
import {emailEvidence} from './email-classification'
import {routingCandidates,verifiedByAuthenticationResults} from './inbound-sender'
import {emailAddress} from './inbound-routing'
const addressList=(entries:any[]|undefined)=>(entries||[]).flatMap((entry:any)=>entry.group?entry.group.map((member:any)=>member.address):[entry.address]).filter(Boolean)
export async function handleEmail(message:ForwardableEmailMessage,env:Env,execution:ExecutionContext){
 if(message.rawSize>25000000){message.setReject('Message exceeds 25 MB');return}
 const raw=await new Response(message.raw).arrayBuffer(),parsed=await PostalMime.parse(raw,{attachmentEncoding:'arraybuffer'})
 // The header From is who wrote the message, verified by Cloudflare's own
 // Authentication-Results; the envelope sender (VERP, forwarding SRS, or empty for
 // bounces and auto-replies) is delivery metadata.
 const envelopeFrom=String(message.from||'').trim(),headerFrom=emailAddress(parsed.from?.address),from=headerFrom||emailAddress(envelopeFrom)
 if(!from){message.setReject('Sender address required');return}
 // A subject-only email is its subject; only a message with nothing at all is refused.
 const body=plainEmail(parsed.text||'',parsed.html||'').trim()||(parsed.attachments.length?'':String(parsed.subject||'').trim());if(!body&&!parsed.attachments.length){message.setReject('A message body is required');return}
 const rawId=parsed.messageId||await hashToken(new TextDecoder().decode(raw)),messageId=rawId.length>200?await hashToken(rawId):rawId
 const senderVerified=Boolean(headerFrom)&&verifiedByAuthenticationResults(parsed.headers,headerFrom!)
 const evidence=emailEvidence({envelopeFrom,headerFrom:parsed.from?.address,subject:parsed.subject,headers:parsed.headers})
 try{
 const result=await receiveEmail(env,{messageId,from,to:routingCandidates({envelope:[message.to],headers:parsed.headers,to:addressList(parsed.to)}),text:body,senderAuthenticated:senderVerified,replyTo:addressList(parsed.replyTo)[0],cc:addressList(parsed.cc),evidence,attachments:parsed.attachments.map(file=>({filename:file.filename||'attachment',contentType:file.mimeType,content:file.content as ArrayBuffer}))})
 scheduleInboundEffects(env,execution,result)
 }catch(error){
  // 409: this Message-ID is already held or being admitted; a bounce would only
  // tell the customer their accepted mail failed.
  if(error instanceof HTTPException&&error.status===409){console.error('Inbound email already received',error.message);return}
  if(error instanceof HTTPException&&error.status>=400&&error.status<500){message.setReject(error.message);return}
  throw error
 }
}
