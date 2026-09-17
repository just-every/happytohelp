import { createActivity } from './activity.mjs';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
export async function createState(root,seed) {
 const fields=seed.model.safeKeys;
 const directory=join(root,'.seed','installer'); await mkdir(directory,{recursive:true,mode:0o700});
 const file=join(directory,'state.json'); let saved={};
 try { const value=JSON.parse(await readFile(file,'utf8')); if(value&&typeof value==='object') saved=value; } catch(error) { if(error.code!=='ENOENT' && !(error instanceof SyntaxError)) throw error; }
 if(saved.product&&saved.product!==seed.product)throw Error('Saved installer details belong to another seed.');
 saved.draft=Object.fromEntries(Object.entries(saved.draft||{}).filter(([key,value])=>fields.includes(key)&&typeof value==='string'));
 const state={phase:'ready',step:'Ready to install',logs:[],answered:Object.keys(saved.draft||{}),sources:Object.fromEntries(Object.entries(saved.sources||{}).filter(([key,value])=>fields.includes(key)&&['agent','browser','saved'].includes(value))),lastUpdate:{revision:Number.isSafeInteger(saved.lastUpdate?.revision)?saved.lastUpdate.revision:0,source:'saved',keys:[]},draft:saved.draft||{},known:{product:seed.product,root,nodeVersion:process.version},...(saved.phase==='running'?{error:'The previous run was interrupted. Review the details before starting again.'}:{})};
 const activity=createActivity(state,fields);
 let pending=Promise.resolve();
 const persist=()=>{const content=JSON.stringify({product:seed.product,phase:state.phase,draft:state.draft,sources:state.sources,lastUpdate:state.lastUpdate});pending=pending.then(async()=>{await writeFile(file+'.tmp',content,{mode:0o600});await rename(file+'.tmp',file)});return pending};
 return {state,activity,async draft(input,source='browser',updatedKeys=Object.keys(input)){const keys=updatedKeys.filter(key=>fields.includes(key));for(const key of keys)if(source==='agent'||input[key]!==state.draft[key])state.sources[key]=source;state.lastUpdate={source,keys,revision:state.lastUpdate.revision+1};state.answered=Object.keys(input).filter(key=>fields.includes(key));state.draft=Object.fromEntries(fields.filter(key=>typeof input[key]==='string').map(key=>[key,input[key]]));await persist();if(source==='agent')activity.filled(keys)},async step(label){state.step=label;state.logs.push(label);activity.step(label);await persist()},async phase(phase){state.phase=phase;activity.phase(phase);await persist()}};
}
