import {Hono} from 'hono'
import {contextTools} from '../../src/modules/ai-support/tools'
import {finalizeGeneration} from '../../src/modules/ai-support/generation-finalization'
import {admitMessage} from '../../src/modules/conversations/admission'
import {searchKnowledge} from '../../src/modules/knowledge/service'
import {isArticleEligibleForAI,readKnowledgeSource} from '../../src/modules/knowledge/public-sources'
import {createConversationRoutes} from '../../src/modules/conversations/routes'
export {ConversationSocket} from '../../src/modules/conversations/socket'
export default {async fetch(request:Request,env:any){
 const url=new URL(request.url)
 if(url.pathname.startsWith('/conversations'))return new Hono().route('/conversations',createConversationRoutes()).fetch(request,env)
 const body:any=await request.json()
 try{
  if(url.pathname==='/search')return Response.json(await searchKnowledge(env,body.projectId,body.query))
  if(url.pathname==='/eligible')return Response.json(await isArticleEligibleForAI(env,body.projectId,body.id,body.sourceVersion))
  if(url.pathname==='/read')return Response.json(await readKnowledgeSource(env,body.projectId,body.ref))
  if(url.pathname==='/admit'){
   if(body.mutateBeforeBatch){const db=env.DB;env={...env,DB:{prepare:(sql:string)=>db.prepare(sql),batch:async(statements:any[])=>{await db.exec(body.mutateBeforeBatch);return db.batch(statements)}}}}
   return Response.json(await admitMessage(env,body))
  }
  const row=await env.DB.prepare('SELECT * FROM ai_generations WHERE id=?').bind(body.generationId).first()
  if(url.pathname==='/tools'){
   const selected:any[]=[],tools=contextTools(env,row.project_id,row.conversation_id,new Set(),new Map(),selected,row.id)
   const call=(name:string,...args:any[])=>tools.find(t=>t.definition.function.name===name)!.function(...args)
   const rows=await call('search_knowledge',body.query)
   const read=body.read?await call('read_knowledge_source',body.read.id,body.read.start??0,body.read.sourceVersion):null
   await call('cite_knowledge',body.refs||rows.filter((r:any)=>r.citation_allowed).map((r:any)=>({id:r.id,sourceVersion:r.sourceVersion})))
   return Response.json({rows,read,selected})
  }
  if(url.pathname==='/finalize')return Response.json(await finalizeGeneration(env,row,body.attemptId,{response:'Policy answer',citations:body.refs},{}))
  return new Response('Not found',{status:404})
 }catch(error){return Response.json({error:String(error)},{status:409})}
}}
