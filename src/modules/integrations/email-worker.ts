// @ts-ignore Maintained pure-JavaScript HTML text parser.
import {convert} from 'html-to-text'
import PostalMime from 'postal-mime'
import type {Env} from '../../platform/env'
import {receiveEmail} from './inbound-service'
import {hashToken} from '../../platform/auth'
import {scheduleInboundEffects} from './inbound-effects'
import {emailEvidence} from './email-classification'
export async function handleEmail(message:ForwardableEmailMessage,env:Env,execution:ExecutionContext){
 if(message.rawSize>25000000){message.setReject('Message exceeds 25 MB');return}
 // A null return path (bounces, RFC 3834 auto-replies) has no sender to become a
 // contact, and the header From is chosen by whoever wrote the message.
 const envelopeFrom=String(message.from||'').trim()
 if(!envelopeFrom||envelopeFrom==='<>'){message.setReject('Envelope sender required');return}
 const raw=await new Response(message.raw).arrayBuffer(),parsed=await PostalMime.parse(raw,{attachmentEncoding:'arraybuffer'})
 const body=(parsed.text|| (parsed.html?convert(parsed.html,{wordwrap:false,selectors:[{selector:'script',format:'skip'},{selector:'style',format:'skip'}]}):'')).trim();if(!body){message.setReject('A message body is required');return}
 const rawId=parsed.messageId||await hashToken(new TextDecoder().decode(raw)),messageId=rawId.length>200?await hashToken(rawId):rawId
 // The SMTP envelope and configured recipient determine routing; message headers never select a tenant.
 // The header From, subject and automatic-mail headers are classification evidence only.
 const evidence=emailEvidence({envelopeFrom,headerFrom:parsed.from?.address,subject:parsed.subject,headers:parsed.headers})
 const result=await receiveEmail(env,{messageId,from:envelopeFrom,to:message.to,text:body,evidence,attachments:parsed.attachments.map(file=>({filename:file.filename||'attachment',contentType:file.mimeType,content:file.content as ArrayBuffer}))})
 scheduleInboundEffects(env,execution,result)
}
