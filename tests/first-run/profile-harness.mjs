import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
export const hash=value=>createHash('sha256').update(value).digest('hex');
export async function profileHarness(){
 const directory=await mkdtemp(join(tmpdir(),'widget-profile-'));let runtime,external=0;const tokens={},widgetSecrets={};
 try{
  await build({entryPoints:['tests/first-run/profile-worker.ts'],bundle:true,format:'esm',platform:'node',external:['node:*','cloudflare:workers'],outfile:join(directory,'worker.mjs'),logLevel:'silent'});
  runtime=new Miniflare(convertV4MiniflareOptions({name:'widget-profile-check',modules:true,script:await readFile(join(directory,'worker.mjs'),'utf8'),compatibilityDate:'2026-09-14',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'widget-profile'},r2Buckets:['FILES'],durableObjects:{CONVERSATIONS:'ConversationSocket'},resourcePersistencePath:join(directory,'state'),resourceTmpPath:join(directory,'tmp'),outboundService:async()=>{external++;throw Error('External requests prohibited')}}));
  const db=await runtime.getD1Database('DB');
  for(const file of (await readdir('migrations')).filter(name=>name.endsWith('.sql')).sort()){
   const sql=(await readFile(join('migrations',file),'utf8')).replace(/^\s*--[^\n]*$/gm,'');
   for(const [,statement] of sql.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g))await db.prepare(statement).run();
  }
  for(const project of ['p','q'])await db.prepare('INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES(?,?,?,?,1)').bind(project,project,'widget-'+project,'https://app.example').run();
  async function session(name,project,contact,{role='contact',expires=Date.now()+3600000}={}){
   const token=tokens[name]=randomBytes(32).toString('hex');
   await db.prepare('INSERT INTO sessions(token_hash,actor_id,project_id,role,contact_id,expires_at) VALUES(?,?,?,?,?,?)').bind(hash(token),contact,project,role,role==='contact'?contact:null,expires).run();
   return token;
  }
  async function contact(name,project='p',{verified=false}={}){
   await db.prepare('INSERT INTO contacts(id,project_id,name,email,external_id,is_verified,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,1)').bind(name,project,'Saved '+name,name+'@example.test',verified?'signed-'+name:null,verified?1:0,JSON.stringify({provided_email:'untrusted-'+name+'@example.test',private_note:'must not reach the widget'})).run();
   return session(name,project,name);
  }
  async function widgetSession(key,{project='p',signed=false,identifier,name,email,metadata}={}){
   const body={widgetKey:'widget-'+project,identifier,name,email};
   if(signed){
    const secret=widgetSecrets[project]??=randomBytes(32).toString('hex');
    await db.prepare('UPDATE projects SET verification_secret=? WHERE id=?').bind(secret,project).run();
    body.contact_hash=createHmac('sha256',secret).update(identifier||email).digest('hex');
    if(metadata){
     const encoded=JSON.stringify(metadata).replaceAll('/','\\/').replace(/[\u007f-\uffff]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));
     body.metadata={...metadata,hash:createHmac('sha256',secret).update(encoded).digest('hex')};
    }
   }
   const response=await raw('/api/identity/widget/session',{actor:null,method:'POST',headers:{Origin:'https://app.example'},body});
   if(response.status!==201)throw Error('Native widget session creation returned '+response.status);
   const result=await response.json();tokens[key]=result.token;return result;
  }
  async function raw(path='/api/identity/widget/profile',{actor='visitor',headers={},body,...options}={}){
   return runtime.dispatchFetch('https://app.example'+path,{...options,headers:{...(actor?{Authorization:'Bearer '+tokens[actor]}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  }
  async function snapshot(){
   const tables=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
   const rows={};for(const {name} of tables)rows[name]=(await db.prepare('SELECT * FROM "'+name+'"').all()).results.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
   return rows;
  }
  return {db,contact,session,widgetSession,raw,snapshot,token:name=>tokens[name],get external(){return external},async close(){await runtime.dispose();await rm(directory,{recursive:true,force:true})}};
 }catch(error){if(runtime)await runtime.dispose();await rm(directory,{recursive:true,force:true});throw error;}
}
