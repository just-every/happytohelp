import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {receiveEmail} from './inbound-service'
import {sendgridInbound} from './sendgrid-inbound'
export const inboundEmail=new Hono<AppEnv>()
inboundEmail.post('/email/inbound',async c=>{if(typeof c.env.INBOUND_EMAIL_TOKEN!=='string'||c.req.header('Authorization')!==`Bearer ${c.env.INBOUND_EMAIL_TOKEN}`)throw new HTTPException(403);const result=await receiveEmail(c.env,await c.req.json());return c.json(result,result.duplicate?200:201)})
inboundEmail.route('/',sendgridInbound)
