import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {hashToken} from '../../platform/auth'
import {receiveEmail} from './inbound-service'
import {scheduleInboundEffects} from './inbound-effects'

export const sendgridInbound=new Hono<AppEnv>()
const maxBody=30*1024*1024
function field(body:Record<string,unknown>,name:string):string{
 const value=body[name]
 return typeof value==='string'?value:Array.isArray(value)&&typeof value[0]==='string'?value[0]:''
}
function json(value:string){try{return JSON.parse(value) as any}catch{return null}}
function address(value:string){
 const parsed=json(value)
 if(parsed&&typeof parsed.email==='string')return parsed.email
 return value
}
function messageId(headers:string,fallback:string){
 const value=headers.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim()||fallback
 return value.length<=200?value:value.slice(0,200)
}
async function contentHash(content:ArrayBuffer){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',content))).map(value=>value.toString(16).padStart(2,'0')).join('')
}
function authorizationToken(value:string|undefined){
 if(!value)return ''
 const bearer=value.match(/^Bearer\s+(.+)$/i)
 if(bearer)return bearer[1]
 const basic=value.match(/^Basic\s+(.+)$/i)
 if(!basic)return ''
 try{
  const decoded=atob(basic[1])
  const separator=decoded.indexOf(':')
  return separator<0?'':decoded.slice(separator+1)
 }catch{return ''}
}
async function authorized(c:any){
 const expected=typeof c.env.INBOUND_EMAIL_TOKEN==='string'?c.env.INBOUND_EMAIL_TOKEN:''
 if(!expected)return false
 const supplied=authorizationToken(c.req.header('Authorization'))||new URL(c.req.url).searchParams.get('token')||''
 const left=await hashToken(expected),right=await hashToken(supplied);let difference=0
 for(let index=0;index<left.length;index++)difference|=left.charCodeAt(index)^(right[index]||'').charCodeAt(0)
 return difference===0&&Boolean(supplied)
}
sendgridInbound.post('/email/sendgrid/inbound',async c=>{
 if(!await authorized(c))throw new HTTPException(403)
 const size=Number(c.req.header('content-length')||0);if(size>maxBody)throw new HTTPException(413,{message:'Inbound email exceeds 30 MB'})
 const raw=await c.req.parseBody(),body=raw as Record<string,unknown>,envelope=json(field(body,'envelope'))||{},envelopeRecipients=Array.isArray(envelope.to)?envelope.to:[],to=address(envelopeRecipients[0]||'')||address(field(body,'to')),from=address(envelope.from||'')||address(field(body,'from')),text=field(body,'text').trim(),html=field(body,'html'),content=text||html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
 const info=json(field(body,'attachment-info'))||{},attachments=[]
 for(const [key,metadata] of Object.entries(info)){
  const file=body[key];if(!(file instanceof File))continue
  const data=await file.arrayBuffer();if(data.byteLength>20000000)throw new HTTPException(413,{message:'Inbound attachment exceeds 20 MB'})
  const record=metadata as any;attachments.push({filename:typeof record?.filename==='string'?record.filename.slice(0,200):file.name||'attachment',contentType:typeof record?.type==='string'?record.type.slice(0,200):file.type||'application/octet-stream',content:data})
 }
 if(!to||!from||(!content&&!attachments.length))throw new HTTPException(400,{message:'SendGrid inbound payload is missing sender, recipient or body'})
 const fallback=await hashToken(JSON.stringify({to,from,subject:field(body,'subject'),content,attachments:await Promise.all(attachments.map(async file=>({filename:file.filename,type:file.contentType,size:file.content.byteLength,hash:await contentHash(file.content)})))})),result=await receiveEmail(c.env,{messageId:messageId(field(body,'headers'),fallback),to,from,text:content,attachments})
 scheduleInboundEffects(c.env,c.executionCtx,result)
 return c.json(result,result.duplicate?200:201)
})
