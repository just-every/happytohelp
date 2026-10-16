import {randomBytes,createHmac} from 'node:crypto'
import {startApp,sha} from '../../journeys/kit/app.mjs'

// A visitor's saved profile on the real application: widget sessions (plain or HMAC-signed), the profile read and the
// widget's contact collector. Workspaces p and q share the widget site; nothing outside is reachable.
export const hash=sha
// A SQL statement with its values written in, for a write that races a request (x-test-before-statement).
export const literal=(text,...values)=>{let index=0;return text.replace(/\?/g,()=>{const value=values[index++];return typeof value==='number'?String(value):`'${String(value).replaceAll("'","''")}'`})}

export async function profileApp(){
 const app=await startApp({origin:'https://app.example',cf:{country:'US'}}),tokens={},widgetSecrets={}
 for(const project of ['p','q'])await app.db.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,1)').bind(project,project,'widget-'+project,'https://app.example').run()
 const session=async(name,project,contact,{role='contact',expires=Date.now()+3600000}={})=>{
  const token=tokens[name]=randomBytes(32).toString('hex')
  await app.db.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,?,?,?,?,?)').bind(hash(token),contact,project,role,role==='contact'?contact:null,expires).run()
  return token
 }
 const contact=async(name,project='p',{verified=false}={})=>{
  await app.db.prepare('INSERT INTO contacts(id,project_id,name,email,external_id,is_verified,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,1)').bind(name,project,'Saved '+name,name+'@example.test',verified?'signed-'+name:null,verified?1:0,JSON.stringify({provided_email:'untrusted-'+name+'@example.test',private_note:'must not reach the widget'})).run()
  return session(name,project,name)
 }
 const raw=(path='/api/identity/widget/profile',{actor='visitor',headers={},body,method}={})=>app.request(path,{method:method||(body===undefined?'GET':'POST'),body,headers:{...(actor?{Authorization:'Bearer '+tokens[actor]}:{}),...headers}})
 const widgetSession=async(key,{project='p',signed=false,identifier,name,email,metadata}={})=>{
  const body={widgetKey:'widget-'+project,identifier,name,email}
  if(signed){
   const secret=widgetSecrets[project]??=randomBytes(32).toString('hex')
   await app.db.prepare('UPDATE projects SET verification_secret=? WHERE id=?').bind(secret,project).run()
   body.contact_hash=createHmac('sha256',secret).update(identifier||email).digest('hex')
   if(metadata){
    const encoded=JSON.stringify(metadata).replaceAll('/','\\/').replace(/[\u007f-￿]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'))
    body.metadata={...metadata,hash:createHmac('sha256',secret).update(encoded).digest('hex')}
   }
  }
  const response=await raw('/api/identity/widget/session',{actor:null,headers:{Origin:'https://app.example'},body})
  if(response.status!==201)throw Error('Native widget session creation returned '+response.status)
  const result=await response.json();tokens[key]=result.token;return result
 }
 const snapshot=async()=>{
  const rows={}
  for(const {name} of await app.sql("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"))rows[name]=(await app.sql(`SELECT * FROM "${name}"`)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return rows
 }
 return {app,get db(){return app.db},contact,session,widgetSession,raw,snapshot,token:name=>tokens[name],get external(){return app.requests.length},close:()=>app.close()}
}
