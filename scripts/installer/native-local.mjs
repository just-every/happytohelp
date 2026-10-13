import {randomBytes} from 'node:crypto';
import {lstat,readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {selectLocalState} from '../base-onboarding/local/state.mjs';
import {readSettings} from '../base-onboarding/adapter-settings.mjs';
import {writePrivateFile} from '../base-onboarding/private-files.mjs';

const generatedToken='INBOUND_EMAIL_TOKEN';
// A key answered for a provider other than the chosen one is contradictory; refuse it before any file is written.
function refuseUnchosenAiKeys(context){
 const chosen=context.input.AI_PROVIDER||'later';
 for(const field of context.manifest?.fields??[])
  if(field.kind==='secret'&&field.when?.field==='AI_PROVIDER'&&field.when.equals!==chosen&&context.input[field.name])
   throw Error(`${field.name} was supplied but the AI service answer is ${chosen}. Remove the key or choose its provider.`);
}
// Base keeps an existing .dev.vars as it is, so a checkout set up before the token existed never gets one from the
// manifest. Append only the missing generated token; every other byte and secret stays as it was.
async function addMissingToken(context,saved){
 if(saved.text===undefined||Object.hasOwn(saved.values,generatedToken))return;
 const field=context.manifest?.fields.find(item=>item.name===generatedToken);
 const value=randomBytes(32).toString(field?.generate??'hex');
 context.store?.addSecrets?.([value]);
 await writePrivateFile(saved.path,saved.text.replace(/\n*$/,'\n')+`${generatedToken}=${value}\n`);
}

export async function prepareNativeLocal(context){
 await selectLocalState(context.root);
 const saved=await readSettings(context.root,{file:'.dev.vars'});
 const legacy=await readFile(join(context.root,'.seed/installer/private/local.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(legacy){const prior=JSON.parse(legacy);if(prior.origin&&prior.origin!==saved.values.APP_ORIGIN)throw Error('Legacy installer origin differs from private settings. Preserve both and recover the intended origin before setup.');}
 if(saved.values.EMAIL_PROVIDER&&saved.values.EMAIL_PROVIDER!=='development')throw Error('The saved mail provider is retained. Use an isolated local checkout for the development-outbox command journey.');
 if(context.input.EMAIL_PROVIDER&&!['later','development'].includes(context.input.EMAIL_PROVIDER))throw Error('Local command setup uses the development outbox. Configure remote mail in the installed workspace.');
 context.input.EMAIL_PROVIDER='development';
 refuseUnchosenAiKeys(context);
 await addMissingToken(context,saved);
}
export async function nativeOwner(context){
 const request=(path,body)=>fetch(context.origin+path,{...(body?{method:'POST',headers:{Origin:context.origin,'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:context.signal});
 const response=await request('/api/identity/setup');
 if(!response.ok)throw context.fail('setup');
 if(!(await response.json()).available){await context.store.step('Existing owner and workspace preserved');return;}
 const input=context.input;
 // Optional answers that were not given are left out, so the server derives them. Base fills an unanswered OWNER_NAME with its
 // declared default, which is empty here, so an empty answer means not given.
 const answers={name:input.WORKSPACE_NAME,ownerName:input.OWNER_NAME,email:input.OWNER_EMAIL,password:input.OWNER_PASSWORD,allowedOrigin:input.WIDGET_ORIGIN,primaryColor:input.PRIMARY_COLOR,setupToken:context.vars.H2H_SETUP_TOKEN};
 const result=await request('/api/identity/bootstrap',Object.fromEntries(Object.entries(answers).filter(([,value])=>typeof value==='string'&&value!=='')));
 if(result.status!==201)throw context.fail('setup');
 const owner=await result.json();context.store.addSecrets(owner.token);
 await context.artworkBridge?.attach({origin:context.origin,token:owner.token,userId:owner.userId,projectId:owner.projectId});
 await context.store.step('Native owner account and workspace created');
}

// Base's localOwner hook: the owners already recorded in the canonical local D1, read before setup changes
// settings, builds or migrates. Native auth keeps owners as memberships, not in Base's operator table.
export async function localOwner(root){
 let directory=root;
 for(const part of ['.wrangler','state','v3','d1','miniflare-D1DatabaseObject']){
  directory=join(directory,part);let status;
  try{status=await lstat(directory);}catch(error){if(error.code==='ENOENT')return [];throw error;}
  if(status.isSymbolicLink()||!status.isDirectory())throw Error('Canonical local state is unsafe. Preserve it and recover its placement before setup.');
 }
 const owners=new Set();
 for(const file of await readdir(directory,{withFileTypes:true})){
  if(!file.isFile()||!file.name.endsWith('.sqlite'))continue;
  const db=new DatabaseSync(join(directory,file.name),{readOnly:true});
  try{
   const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
   if(!tables.has('users')||!tables.has('memberships'))continue;
   for(const {email} of db.prepare("SELECT DISTINCT users.email AS email FROM memberships JOIN users ON users.id=memberships.user_id WHERE memberships.role='owner'").all())if(typeof email==='string')owners.add(email);
  }finally{db.close();}
 }
 return [...owners];
}
