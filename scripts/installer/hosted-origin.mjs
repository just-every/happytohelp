import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {invalid} from '@runeditrun/rer/errors';

/** A custom public address changes application links, never resource identity. */
export async function hostedDeclaration(root,declaration,value){
 if(value===undefined||value==='')return null;
 let url;
 try{url=new URL(value);}catch{}
 if(!url||url.protocol!=='https:'||url.username||url.password||url.port||url.origin!==value)
  throw invalid('H2H_PUBLIC_ORIGIN must be an exact HTTPS origin, without credentials, path, query or fragment.');
 const {originVar,...custom}=declaration;
 custom.vars={...custom.vars,[originVar||'APP_ORIGIN']:url.origin};
 const path='.rer/hosted-deploy.json';
 await mkdir(join(root,'.rer'),{recursive:true,mode:0o700});
 await writeFile(join(root,path),JSON.stringify(custom,null,2)+'\n',{mode:0o600});
 return path;
}
