import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
export const imageLimit=12*1024*1024;
export function validatePng(bytes){
 if(bytes.length<33||bytes.length>imageLimit||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Supply a PNG image under 12 MB.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>8192||height>8192||![4,6].includes(bytes[25]))throw Error('Sidebar artwork must be a PNG with an alpha channel and dimensions up to 8192 pixels.');
 return bytes;
}
export function workspaceContext(draft){
 try{
  const url=new URL(draft.allowedOrigin);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||typeof draft.name!=='string'||!draft.name.trim()||draft.name.length>200||!/^#[a-f0-9]{6}$/i.test(draft.primaryColor||''))return null;
  return {website:url.origin,name:draft.name.trim(),primaryColor:draft.primaryColor.toLowerCase()};
 }catch{return null;}
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateSiteBrief(input,context){
 if(!input||input.website!==context.website||typeof input.summary!=='string'||!input.summary.trim()||input.summary.length>2000||!Array.isArray(input.subjects)||!input.subjects.length||input.subjects.length>8||input.subjects.some(value=>typeof value!=='string'||!value.trim()||value.length>160))throw Error('Provide the actual website, a factual summary, and one to eight visual subjects from the site.');
 let source;try{source=new URL(input.sourceUrl);}catch{throw Error('Provide the website URL inspected for this brief.');}
 if(!['http:','https:'].includes(source.protocol)||source.username||source.password)throw Error('Provide a public HTTP website source.');
 return {website:context.website,sourceUrl:source.href,summary:input.summary.trim(),subjects:input.subjects.map(value=>value.trim())};
}
export async function createWorkspaceArt(root,store,{onSidebar=async()=>{}}={}){
 const directory=join(root,'.seed/installer/workspace-art');await mkdir(directory,{recursive:true,mode:0o700});
 const file=join(directory,'job.json');let job;
 try{job=JSON.parse(await readFile(file,'utf8'));if(!/^[a-f0-9]{32}$/.test(job.id))job=undefined;}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 if(job){if(/^#[a-f0-9]{6}$/i.test(job.context?.primaryColor||''))job.context.primaryColor=job.context.primaryColor.toLowerCase();if(job.phase!=='ready'){job.phase='error';job.error='The previous generation session ended. Reconcile its provider result before retrying.';}job.sessionId=store.state.sessionId;store.state.workspaceArt=job;}
 let saving=Promise.resolve(),receiving=false;
 const persist=()=>{store.state.workspaceArt=job;const content=JSON.stringify(job);saving=saving.then(async()=>{await writeFile(file+'.tmp',content,{mode:0o600});await rename(file+'.tmp',file)});return saving;};
 const valid=()=>job&&same(job.context,workspaceContext(store.state.draft));
 const refresh=async()=>{if(job&&['queued','generating'].includes(job.phase)&&!valid()){job.phase='error';job.error='The workspace website or branding changed. This result is stale.';await persist();}};
 const current=input=>{if(!valid()||input.id!==job.id||Number(input.revision)!==job.revision||input.sessionId!==store.state.sessionId||job.sessionId!==store.state.sessionId)throw Error('The workspace artwork request changed. Inspect the current request.');};
 async function deliverSidebar(){
  if(job?.phase!=='ready'||!valid())return;
  const {id,revision,context}=job;
  await onSidebar({bytes:await readFile(join(directory,id+'.png')),id,revision,context,isCurrent:()=>job?.id===id&&job.revision===revision&&same(context,workspaceContext(store.state.draft))});
 }
 return {
  refresh,deliverSidebar,
  async request(input={}){
   await refresh();if(!store.state.agent?.attached)return null;
   const context=workspaceContext(store.state.draft);if(!context)return null;
   if(input.action==='retry'){current(input);if(job.phase!=='error')throw Error('This request is already active.');job.phase='queued';job.revision++;delete job.siteBrief;delete job.error;await persist();return job;}
   if(job&&same(context,job.context))return job;
   job={id:randomBytes(16).toString('hex'),revision:(job?.revision||0)+1,sessionId:store.state.sessionId,context,phase:'queued',requiredOutputs:['sidebar']};await persist();return job;
  },
  async report(input){
   await refresh();current(input);
   if(input.phase==='generating'){if(job.phase!=='queued')throw Error('This request has already been claimed.');job.siteBrief=validateSiteBrief(input.siteBrief,job.context);job.phase='generating';}
   else if(input.phase==='error'){if(!['queued','generating'].includes(job.phase))throw Error('This request has finished.');job.phase='error';job.error='The agent could not finish workspace artwork. Reconcile the provider result before retrying.';}
   else throw Error('Use generating or error.');await persist();return job;
  },
  async complete(input,bytes){
   await refresh();current(input);if(input.kind&&input.kind!=='sidebar')throw Error('Only sidebar artwork is supported.');
   if(receiving||job.phase!=='generating'||!job.siteBrief)throw Error('Claim the current job with a researched site brief before supplying its image.');validatePng(bytes);receiving=true;
   try{await writeFile(join(directory,job.id+'.png'),bytes,{mode:0o600});current(input);if(job.phase!=='generating')throw Error('This request changed while receiving its image.');job.phase='ready';await persist();await deliverSidebar();return job;}finally{receiving=false;}
  }
 };
}
