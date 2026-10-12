import {publishResolution} from '../outcomes/state'
import {contactAvailableSql} from '../conversations/contact-privacy'
import {HTTPException} from 'hono/http-exception'
import type {Hono} from 'hono'
import {admitMessage,reservedLocalId} from '../conversations/admission'
import {transitionConversation} from '../outcomes/resolve'
import {applyMessageEffects} from '../../message-effects'
import {type ApiEnv,requireScope,iso,page,jsonBody} from './http'
export function conversationApi(app:Hono<ApiEnv>){
 const read=requireScope('conversations:read')
 async function conversation(c:any){const a=c.get('authority'),row=await c.env.DB.prepare(`SELECT c.* FROM conversations c WHERE c.id=? AND c.project_id=? AND ${contactAvailableSql()}`).bind(c.req.param('id'),a.projectId).first();if(!row)throw new HTTPException(404,{message:'Not found'});return row}
 app.get('/conversations',read,async c=>{
  const a=c.get('authority'),q=c.req.query(),status=q.status||'all',since=q.updated_since?Date.parse(q.updated_since):null,tag=q.tag||null
  if(!['open','resolved','all'].includes(status)||since!==null&&!Number.isFinite(since)||tag&&tag.length>200)throw new HTTPException(400,{message:'Invalid conversation filter'})
  const paging=page(q,{project:a.projectId,resource:'conversations',status,since,tag}),pred=['c.project_id=?',contactAvailableSql()],params:any[]=[a.projectId]
  if(status!=='all')pred.push(`c.resolved_at IS ${status==='open'?'':'NOT '}NULL`)
  if(since!==null){pred.push('c.updated_at>=?');params.push(since)}
  if(tag){pred.push('EXISTS(SELECT 1 FROM conversation_tags t JOIN workspace_tags w ON w.id=t.tag_id AND w.project_id=t.project_id WHERE t.conversation_id=c.id AND t.project_id=c.project_id AND (w.id=? OR w.name=?))');params.push(tag,tag)}
  if(paging.cursor){pred.push('(c.updated_at<? OR (c.updated_at=? AND c.id<?))');params.push(paging.cursor.time,paging.cursor.time,paging.cursor.id)}
  const rows=await c.env.DB.prepare(`SELECT c.* FROM conversations c WHERE ${pred.join(' AND ')} ORDER BY c.updated_at DESC,c.id DESC LIMIT ?`).bind(...params,paging.size+1).all()
  return c.json(paging.finish(rows.results,'updated_at'))
 })
 app.get('/conversations/:id',read,async c=>c.json({data:iso(await conversation(c))}))
 app.get('/conversations/:id/messages',read,async c=>{const row=await conversation(c),q=c.req.query(),p=page(q,{project:row.project_id,resource:'messages',conversation:row.id}),args:any[]=[row.project_id,row.id];if(p.cursor)args.push(p.cursor.time,p.cursor.time,p.cursor.id);const rows=await c.env.DB.prepare(`SELECT * FROM messages WHERE project_id=? AND conversation_id=? AND erased_at IS NULL AND EXISTS(SELECT 1 FROM conversations c WHERE c.id=messages.conversation_id AND c.project_id=messages.project_id AND ${contactAvailableSql()}) ${p.cursor?'AND (revision<? OR (revision=? AND id<?))':''} ORDER BY revision DESC,id DESC LIMIT ?`).bind(...args,p.size+1).all();return c.json({...p.finish(rows.results,'revision'),revision:row.revision,last_message_id:row.last_message_id})})
 app.post('/conversations/:id/messages',requireScope('messages:write'),async c=>{
  const current=await conversation(c),a=c.get('authority'),b=await jsonBody(c)
  if(typeof b.localId!=='string'||!b.localId||b.localId.length>200||typeof b.content!=='string'||!b.content.trim()||b.content.length>100000||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||reservedLocalId(b.localId)||b.authoring!==undefined||b.generationId!==undefined||b.resolve!==undefined)throw new HTTPException(400,{message:'Invalid API reply command'})
  const actor={id:'api:'+a.tokenId,projectId:a.projectId,role:'operator' as const}
  const result=await admitMessage(c.env,{actor,projectId:a.projectId,conversationId:current.id,localId:b.localId,content:b.content,expectedRevision:b.expectedRevision,expectedLastMessageId:b.expectedLastMessageId,tokenAuthority:a})
  if(!result.accepted)throw new HTTPException(409,{message:'Conversation or authority changed'})
  if(!result.duplicate)c.executionCtx.waitUntil(applyMessageEffects(c.env,result.message!,actor))
  c.executionCtx.waitUntil(Promise.all([publishResolution(c.env,a.projectId,current.id),...[current.id,`project:${a.projectId}`].map(key=>c.env.CONVERSATIONS.get(c.env.CONVERSATIONS.idFromName(key)).fetch('https://conversation.internal/broadcast',{method:'POST'}))]))
  return c.json({data:iso(result.message),duplicate:result.duplicate})
 })
 app.post('/conversations/:id/resolve',requireScope('conversations:write'),async c=>{await conversation(c);const a=c.get('authority');return c.json({data:await transitionConversation(c.env,{id:'api:'+a.tokenId,projectId:a.projectId,role:'operator'},c.req.param('id'),{resolved:true},undefined,a)})})
}
