import {link,writeFile,readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {publishDirectory,readManifest,readPart,writePart,packageContext,safeFile,sha} from './package.mjs';
import {omitSupportCredentials,omitKnownCredentials,knownCredentials,sanitizable} from './text-policy.mjs';
import {classifySnapshot} from './secrets.mjs';

async function fileHash(file){const h=createHash('sha256');let size=0;for await(const chunk of createReadStream(file)){h.update(chunk);size+=chunk.length;}return {sha256:h.digest('hex'),size};}
const add=(counts,key,n)=>{if(n)counts[key]=(counts[key]||0)+n;};
const sum=(...maps)=>{const out={};for(const m of maps)for(const [k,n] of Object.entries(m||{}))add(out,k,n);return out;};

/**
 * Apply the current text policy to an exported chunked package's rows and publish a
 * complete new package: one output part per input part with the same rows, regenerated
 * digests and manifest, attachments hard-linked byte-identical. The input is only read.
 */
export async function repassPackage(input,output,{policyRevision}){
  if(!policyRevision)throw Error('Repass requires --policy-revision (the exporter commit applying the policy)');
  const manifestBytes=await readFile(path.join(input,'manifest.json')),manifest=await readManifest(input);
  // First read: every value the policy now removes, so its repeats are removed everywhere.
  const secrets=new Set();
  for(const part of manifest.chunks)for(const row of await readPart(input,part))for(const [column,value] of Object.entries(row))
    if(sanitizable(part.table,column))omitSupportCredentials(part.table,column,value,secret=>secrets.add(String(secret)));
  const known=knownCredentials(secrets);
  return publishDirectory(output,async root=>{
    const omittedText={},repeated={};let rowBytes=0;const rewrite=async parts=>{const out=[];for(const part of parts){
      const rows=await readPart(input,part);
      for(const row of rows)for(const column of Object.keys(row)){
        if(!sanitizable(part.table,column))continue;
        const text=omitSupportCredentials(part.table,column,row[column]);row[column]=text.value;
        const again=omitKnownCredentials(row[column],known);row[column]=again.value;
        if(parts===manifest.chunks){add(omittedText,`${part.table}.${column}`,text.omitted);add(repeated,`${part.table}.${column}`,again.omitted);}
      }
      if(parts===manifest.chunks)for(const row of rows)rowBytes+=Buffer.byteLength(JSON.stringify(row));
      classifySnapshot({tables:{[part.table]:rows}});
      if(rows.length!==part.count)throw Error('Package row count mismatch');
      out.push({table:part.table,count:rows.length,...await writePart(root,part.file,rows)});
    }return out;};
    const chunks=await rewrite(manifest.chunks),context=await rewrite(manifest.context);
    for(const object of manifest.objects){
      await link(safeFile(input,object.file),safeFile(root,object.file));
      const copied=await fileHash(safeFile(root,object.file));if(copied.size!==object.size||copied.sha256!==object.sha256)throw Error('Package object size or digest mismatch');
    }
    const source={...manifest.source,rowBytes,
      omittedTextValueCounts:sum(manifest.source.omittedTextValueCounts,omittedText),
      repeatedCredentialValueCounts:sum(manifest.source.repeatedCredentialValueCounts,repeated),
      textPolicyRepasses:[...(manifest.source.textPolicyRepasses||[]),{policyRevision,at:new Date().toISOString(),inputManifestSha256:sha(manifestBytes),omittedTextValueCounts:omittedText,repeatedCredentialValueCounts:repeated}]};
    const result={...manifest,source,chunks,context};
    await packageContext(root,result);
    await writeFile(path.join(root,'manifest.json'),JSON.stringify(result),{mode:0o600,flag:'wx'});
    return result;
  });
}
