// @ts-ignore Maintained pure-JavaScript HTML text parser.
import {convert} from 'html-to-text'
import PostalMime from 'postal-mime'
import type {Env} from '../../platform/env'
import {receiveEmail} from './inbound-service'
import {hashToken} from '../../platform/auth'
import {scheduleInboundEffects} from './inbound-effects'
export async function handleEmail(message:ForwardableEmailMessage,env:Env,execution:ExecutionContext){
 if(message.rawSize>25000000){message.setReject('Message exceeds 25 MB');return}
 const raw=await new Response(message.raw).arrayBuffer(),parsed=await PostalMime.parse(raw,{attachmentEncoding:'arraybuffer'})
 const body=(parsed.text|| (parsed.html?convert(parsed.html,{wordwrap:false,selectors:[{selector:'script',format:'skip'},{selector:'style',format:'skip'}]}):'')).trim();if(!body){message.setReject('A message body is required');return}
 const rawId=parsed.messageId||await hashToken(new TextDecoder().decode(raw)),messageId=rawId.length>200?await hashToken(rawId):rawId
 // The SMTP envelope and configured recipient determine routing; message headers never select a tenant.
 const result=await receiveEmail(env,{messageId,from:message.from,to:message.to,text:body,attachments:parsed.attachments.map(file=>({filename:file.filename||'attachment',contentType:file.mimeType,content:file.content as ArrayBuffer}))})
 scheduleInboundEffects(env,execution,result)
}
