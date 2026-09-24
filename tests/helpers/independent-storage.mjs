import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {getPlatformProxy} from 'wrangler';

// Native local D1/R2 bindings, opened only while the application runtime is
// stopped. Do not run a second storage owner against a live application.
export async function withArtifactStorage(directory,config,visit) {
 const configPath=join(directory,'storage.wrangler.json');
 await writeFile(configPath,JSON.stringify({name:config.name,compatibility_date:config.compatibility_date,compatibility_flags:config.compatibility_flags,d1_databases:config.d1_databases,r2_buckets:config.r2_buckets}));
 const proxy=await getPlatformProxy({configPath,envFiles:[],remoteBindings:false,persist:{path:join(directory,'.wrangler/state/v3')}});
 const inspect=async body=>{
  if(body.sql)return proxy.env.DB.prepare(body.sql).bind(...(body.values||[])).all();
  if(body.list)return proxy.env.FILES.list(body.list);
  if(body.key){
   if(body.bytes)await proxy.env.FILES.put(body.key,Uint8Array.from(body.bytes),body.options);
   const object=await proxy.env.FILES.get(body.key);
   return object?{key:object.key,bytes:Array.from(new Uint8Array(await object.arrayBuffer())),httpMetadata:object.httpMetadata,customMetadata:object.customMetadata}:null;
  }
  throw new Error('Unknown native storage inspection');
 };
 try{return await visit({inspect});}finally{await proxy.dispose();}
}
