import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {receiveEmail} from './inbound-service'
import {emailEvidence,gatewayHeaderEntries} from './email-classification'
import {sendgridInbound} from './sendgrid-inbound'
export const inboundEmail=new Hono<AppEnv>()
inboundEmail.post('/email/inbound',async c=>{if(typeof c.env.INBOUND_EMAIL_TOKEN!=='string'||c.req.header('Authorization')!==`Bearer ${c.env.INBOUND_EMAIL_TOKEN}`)throw new HTTPException(403);const body=await c.req.json()
 // `from` is the sender the gateway authenticated. `envelopeFrom` (the SMTP return path, empty for a
 // null sender), `subject` and `headers` (name to value) are optional classification evidence.
 const evidence=emailEvidence({envelopeFrom:typeof body?.envelopeFrom==='string'?body.envelopeFrom:body?.from,headerFrom:body?.from,subject:body?.subject,headers:gatewayHeaderEntries(body?.headers)})
 const result=await receiveEmail(c.env,{...body,evidence,senderAuthenticated:true});return c.json(result,result.duplicate?200:201)})
inboundEmail.route('/',sendgridInbound)
