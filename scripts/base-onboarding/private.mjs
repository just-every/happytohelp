import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
export async function installationReceipt(root,origin,scope){
 const path=join(root,'.seed/installer/private',createHash('sha256').update(origin).digest('hex')+'.json');
 let saved;try{saved=JSON.parse(await readFile(path,'utf8'))}catch(error){if(error.code==='ENOENT')return null;throw error}
 if(saved.origin!==origin||typeof saved.token!=='string'||!saved.token)throw Error('The saved installation receipt is invalid. Preserve it and inspect this installation before continuing.');
 if(scope&&(saved.accountId!==scope.accountId||saved.prefix!==scope.prefix))throw Error('The saved installation receipt does not identify this Cloudflare account and Worker. Preserve it and verify the existing installation before continuing.');
 return saved;
}
export async function installationCredential(root,origin,scope){
 const directory=join(root,'.seed/installer/private');await mkdir(directory,{recursive:true,mode:0o700});
 const path=join(directory,createHash('sha256').update(origin).digest('hex')+'.json');
 const saved=await installationReceipt(root,origin,scope);let token=saved?.token,deployed=saved?.deployed===true;
 const record=()=>({origin,token,...(scope?{accountId:scope.accountId,prefix:scope.prefix}:{})});
 if(!token){token=randomBytes(32).toString('hex');await writeFile(path,JSON.stringify(record()),{mode:0o600})}
 return {token,deployed,markDeployed:()=>writeFile(path,JSON.stringify({...record(),deployed:true}),{mode:0o600}),clear:()=>unlink(path)};
}
export async function localSetupToken(root,key){
 try{const text=await readFile(join(root,'.dev.vars'),'utf8');const line=text.split(/\r?\n/).find(value=>value.slice(0,value.indexOf('=')).trim()===key);if(!line)return undefined;const value=line.slice(line.indexOf('=')+1).trim();return /^['"].*['"]$/.test(value)?value.slice(1,-1):value}catch(error){if(error.code==='ENOENT')return undefined;throw error}
}
export function stopChild(child){if(!child||child.exitCode!==null)return;try{process.kill(-child.pid,'SIGTERM')}catch{child.kill('SIGTERM')}}
export async function persistLocalEmail(root,variables){
 const path=join(root,'.dev.vars');let content='';try{content=await readFile(path,'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
 const lines=content.split(/\r?\n/).filter(line=>!Object.keys(variables).some(key=>line.startsWith(key+'=')));
 await writeFile(path,lines.join('\n').replace(/\n*$/,'\n')+Object.entries(variables).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});
}
export async function localEmailBindings(root){
 let text;try{text=await readFile(join(root,'.dev.vars'),'utf8')}catch(error){if(error.code==='ENOENT')return {};throw error}
 const allowed=new Set(['EMAIL_PROVIDER','EMAIL_FROM','EMAIL_ACCOUNT_ID','EMAIL_API_KEY']);const values={};
 for(const line of text.split(/\r?\n/)){const index=line.indexOf('=');const key=line.slice(0,index).trim();if(index<0||!allowed.has(key))continue;let value=line.slice(index+1).trim();if(value.startsWith('"')){try{value=JSON.parse(value)}catch{continue}}else if(value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);values[key]=value}
 return values;
}
