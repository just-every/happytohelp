import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server.edge'
import Markdown from 'h2h-widget-markdown'
import gfm from 'h2h-widget-gfm'
import type {Env} from '../../platform/env'
import type {EmailAttachment} from './email'
import {emailFileLink} from './email-file-links'

type MailMessage={id:string;actor_id?:string;actor_role:string;content:unknown;created_at?:number;erased_at?:number|null;source_author?:{name?:string|null;role?:string}|null}
type Media={id:string;object_key:string;filename:string;content_type:string;size:number}
/** A file the email names and links instead of carrying. */
export type OmittedFile={filename:string;reason:'too_large'|'unavailable';url?:string}
const inlineImages=new Set(['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp'])
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
// Encoded attachments stay under the 24 MiB whole-email check (validateEmailInput),
// leaving room for the text and HTML bodies.
const maxFileBytes=8*1024*1024,maxEncodedBytes=20*1024*1024
function base64(bytes:Uint8Array){let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary)}
function markdown(content:string){return renderToStaticMarkup(createElement(Markdown,{remarkPlugins:[gfm],children:content,urlTransform:(uri,key)=>((key==='src'?/^https?:\/\//i:/^(?:https?:\/\/|mailto:)/i).test(uri)?uri:'')}))}
async function authorName(env:Env,projectId:string,conversationId:string,message:MailMessage){
 if(message.source_author)return message.source_author.name||(message.source_author.role==='contact'?'Customer':'Imported author')
 if(message.actor_id?.startsWith('import:')){
  const imported=await env.DB.prepare('SELECT author_json FROM move_in_message_sources WHERE message_id=? AND project_id=?').bind(message.id,projectId).first<{author_json:string}>()
  if(imported)return JSON.parse(imported.author_json).name||'Imported author'
 }
 if(message.actor_id){
  const row=message.actor_role==='contact'
   ?await env.DB.prepare('SELECT name,email,metadata_json FROM contacts WHERE id=? AND project_id=?').bind(message.actor_id,projectId).first<{name:string|null;email:string|null;metadata_json:string}>()
   :message.actor_role==='ai'
    ?await env.DB.prepare('SELECT name FROM ai_profiles WHERE id=? AND project_id=?').bind(message.actor_id,projectId).first<{name:string}>()
    :await env.DB.prepare('SELECT u.name FROM users u JOIN messages m ON m.actor_id=u.id WHERE u.id=? AND m.id=? AND m.project_id=? AND m.conversation_id=?').bind(message.actor_id,message.id,projectId,conversationId).first<{name:string}>()
  if(row){const contact=row as {name?:string;email?:string;metadata_json?:string};const metadata=contact.metadata_json?JSON.parse(contact.metadata_json):{};return String(metadata.provided_name||contact.name||contact.email||(message.actor_role==='contact'?'Customer':'Support'))}
 }
 return message.actor_role==='contact'?'Customer':'Support'
}
const megabytes=(size:number)=>`${(size/1024/1024).toFixed(1)} MB`
/** Shared by notifications and explicit transcript sends. Media bytes are read only
 * through a message + conversation + workspace join, never through a supplied URL.
 * The email always renders: a file over the provider limit, or one that cannot be
 * read, is left out and named with a link to it in the conversation. */
export async function renderConversationEmail(env:Env,input:{projectId:string;conversationId:string;messages:readonly MailMessage[]}){
 const attachments:EmailAttachment[]=[],omitted:OmittedFile[]=[],text:string[]=[],html:string[]=[]
 let encodedBytes=0
 for(const message of input.messages){
  if(message.erased_at||message.actor_role==='system')continue
  const [name,media]=await Promise.all([
   authorName(env,input.projectId,input.conversationId,message),
   env.DB.prepare('SELECT a.id,a.object_key,a.filename,a.content_type,a.size FROM media a JOIN messages m ON m.id=a.message_id AND m.project_id=a.project_id AND m.conversation_id=a.conversation_id WHERE m.id=? AND m.project_id=? AND m.conversation_id=? ORDER BY a.created_at,a.id').bind(message.id,input.projectId,input.conversationId).all<Media>(),
  ])
  const content=String(message.content??''),body:string[]=[markdown(content)],files:string[]=[]
  for(const file of media.results){
   const filename=file.filename.replace(/[\x00-\x1f\x7f]/g,'').slice(0,200)||'attachment',encoded=4*Math.ceil(file.size/3)
   const fits=file.size<=maxFileBytes&&encodedBytes+encoded<=maxEncodedBytes
   const object=fits?await env.FILES.get(file.object_key):null
   if(!object||object.size!==file.size){
    const left:OmittedFile={filename,reason:fits?'unavailable':'too_large',url:await emailFileLink(env,input.projectId,input.conversationId,file.id)}
    const why=left.reason==='too_large'?`${megabytes(file.size)}, too large to attach`:'could not be attached'
    omitted.push(left)
    files.push(`Not attached: ${filename} (${why})${left.url?`. View it in the conversation: ${left.url}`:'. It is in the conversation.'}`)
    body.push(`<p>Not attached: ${left.url?`<a href="${escape(left.url)}">${escape(filename)}</a>`:escape(filename)} (${escape(why)})${left.url?'':'. It is in the conversation.'}</p>`)
    continue
   }
   encodedBytes+=encoded
   const bytes=new Uint8Array(await object.arrayBuffer())
   const contentType=file.content_type.split(';',1)[0].trim().toLowerCase()
   const type=/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType)?contentType:'application/octet-stream'
   const contentId=inlineImages.has(type)?`media-${attachments.length}@happytohelp`:undefined
   attachments.push({filename,content:base64(bytes),contentType:type,...(contentId?{contentId}:{})})
   files.push(`Attachment: ${filename}`)
   body.push(contentId?`<p><img src="cid:${contentId}" alt="${escape(filename)}" style="max-width:100%;height:auto" /></p>`:`<p>Attachment: ${escape(filename)}</p>`)
  }
  text.push([name,content,...files].filter(Boolean).join('\n'))
  html.push(`<section><p><strong>${escape(name)}</strong></p>${body.join('')}</section>`)
 }
 return {text:text.join('\n\n'),html:`<div>${html.join('<hr />')}</div>`,attachments,omitted}
}
