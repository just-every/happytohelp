import type { Env } from '../../platform/env'
export interface DocumentInput { url: string; title: string; content: string }
export function chunks(text: string, size=1000): string[] {
 const result: string[]=[]; let rest=text.trim();
 while(rest.length>size){let end=rest.lastIndexOf('\n',size);if(end<size/2)end=rest.lastIndexOf(' ',size);if(end<size/2)end=size;result.push(rest.slice(0,end));rest=rest.slice(end).trim()}
 if(rest)result.push(rest);return result
}
function config(env:Env,key:string){const value=env[key];if(typeof value!=='string'||!value)throw new Error(`CONFIGURATION_INVALID: ${key} required`);return value}
async function json(response:Response){if(!response.ok)throw new Error(`Provider request failed (${response.status})`);return response.json() as Promise<any>}
export async function apifyDocuments(env:Env,datasetId:string):Promise<DocumentInput[]>{
 const data=await json(await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true`,{headers:{Authorization:`Bearer ${config(env,'APIFY_TOKEN')}`}}));
 if(!Array.isArray(data))throw new Error('Invalid Apify dataset');
 return data.map(x=>({url:x.url,title:x.title||x.url,content:x.text||x.markdown}));
}
export async function embeddings(env:Env,input:string[]):Promise<number[][]>{
 const data=await json(await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${config(env,'OPENAI_API_KEY')}`,'Content-Type':'application/json'},body:JSON.stringify({model:config(env,'KNOWLEDGE_EMBEDDING_MODEL'),input})}));
 if(!Array.isArray(data.data)||data.data.length!==input.length)throw new Error('Invalid embedding response');
 return data.data.sort((a:any,b:any)=>a.index-b.index).map((x:any)=>x.embedding)
}
export async function qdrant(env:Env,path:string,method:string,body?:unknown){
 const base=new URL(config(env,'QDRANT_URL'));if(base.protocol!=='https:')throw new Error('QDRANT_URL requires HTTPS');
 const response=await fetch(new URL(path,base),{method,headers:{'api-key':config(env,'QDRANT_API_KEY'),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(method==='DELETE'&&response.status===404)return {result:true};return json(response)
}
export const collection=(version:string)=>`h2h_${version.replaceAll('-','')}`
export async function deleteSemantic(env:Env,version:string){await qdrant(env,`/collections/${collection(version)}`,'DELETE')}
