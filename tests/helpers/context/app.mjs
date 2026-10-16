import assert from 'node:assert/strict'
import {startApp} from '../../journeys/kit/app.mjs'
import {openaiStream,formatName} from '../openai-stream.mjs'

export const model='gpt-5.6-luna'

// A workspace with proactive help enabled and a ready visitor assistant, on the real application.
// Only the model provider is a fixture: `ai.answer(name,body)` answers each named structured request.
export async function contextApp(){
 const ai={calls:[],answer:()=>{throw new Error('no model answer configured')}}
 const app=await startApp({captureQueue:true,bindings:{OPENAI_API_KEY:'test-only'},outbound:async request=>{
  assert.equal(new URL(request.url).hostname,'api.openai.com','only the model provider is called')
  const body=await request.json(),name=formatName(body);ai.calls.push({name,body});return openaiStream(await ai.answer(name,body))
 }})
 const workspace=await app.seedWorkspace('ctx',{allowedOrigin:'https://widget.example'}),p=workspace.projectId,operator=workspace.tokens.operator
 await app.db.batch([
  app.db.prepare("INSERT INTO ai_profiles(id,project_id,name,role,prompt,model,created_at) VALUES('assistant',?,'Helper','support','Help visitors',?,1)").bind(p,model),
  app.db.prepare('INSERT INTO project_settings(project_id,settings_json,updated_at) VALUES(?,?,1)').bind(p,JSON.stringify({is_contact_tracking_enabled:true,proactive_help_enabled:true,default_visitor_ai_id:'assistant'})),
 ])
 // A visitor with a widget session and a conversation; `widget(action,data)` sends a widget event.
 const visitor=async(name='Visitor')=>{
  const session=(await app.call('/api/identity/widget/session',{body:{widgetKey:workspace.widgetKey,name},headers:{Origin:'https://widget.example'},status:201})).data
  const conversation=(await app.call('/api/conversations',{token:session.token,body:{projectId:p},status:201})).data
  return {...session,conversationId:conversation.id,widget:(action,data,status)=>app.call(`/api/conversations/${conversation.id}/widget-events`,{token:session.token,body:{action,data},status})}
 }
 const context=(path,options={})=>app.call(`/api/customer-context/${p}${path}`,{token:operator,...options})
 return {app,ai,p,workspace,operator,visitor,context,close:()=>app.close()}
}
