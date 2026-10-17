#!/usr/bin/env node
// Independent secret scan of an exported legacy package folder (a company folder holding
// snapshot/ and import/, or one package). It shares no rule with the exporter's text policy.
//  1. its own signatures over the raw bytes of every file (rows, context, manifests, objects, logs);
//  2. its own string checks over every decoded string of every row and context part.
// Output: kinds, files, table.column, row ids and masked shapes only. Never a value.
import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {byteSignatures,stringFindings} from './legacy-scan/signatures.mjs';

const {values,positionals}=parseArgs({allowPositionals:true,options:{output:{type:'string'},help:{type:'boolean'}}});
if(values.help||positionals.length!==1){console.log('node scripts/scan-legacy-package.mjs PACKAGE_FOLDER [--output result.json]\nWrites PACKAGE_FOLDER/secret-signatures.json unless --output is given; exits 1 unless the scan passes.');process.exit(values.help?0:2);}
const root=path.resolve(positionals[0]);
const mask=s=>s.replace(/[a-z]/g,'a').replace(/[A-Z]/g,'A').replace(/[0-9]/g,'9').replace(/[^aA9]/g,c=>/[\s]/.test(c)?' ':c).slice(0,24)+(s.length>24?`…(${s.length})`:'');
// Attachments and their file names are byte-exact customer originals, outside the text
// policy, imported unchanged by the lane's decision. Signatures in them are listed by kind
// and file (attachmentFindings, attachmentNameTokens) for the owner; they do not decide
// the scan, which judges every row, context part, manifest and log.
const attachment=file=>/(?:^|\/)(?:source-objects\/|import\/object-\d+\.bin$|object-\d+\.bin$)/.test(path.relative(root,file));
const attachmentName=(table,column)=>table==='media'&&['filename','filename_original'].includes(column);
async function* files(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())yield* files(full);
    else if(entry.isFile()&&!/^secret-.*\.json$/.test(entry.name))yield full;
  }
}
function* strings(value){
  if(typeof value==='string')yield value;
  else if(value&&typeof value==='object')for(const v of Object.values(value))yield* strings(v);
}
const parts=new Map();
for(const dir of ['.','snapshot','import']){
  const manifest=path.join(root,dir,'manifest.json');
  try{await stat(manifest);}catch{continue;}
  const m=JSON.parse(await readFile(manifest,'utf8'));
  for(const p of [...m.chunks,...m.context])parts.set(path.join(root,dir,p.file),p.table);
}
const result={root,layers:['own signatures over every byte of every file','own string checks over every decoded row and context string'],
  filesScanned:0,bytesScanned:0,rowPartsValidated:0,rowsValidated:0,stringsChecked:0,signatureHits:{},stringHits:{},attachmentFindings:{},attachmentNameTokens:{},shapes:{}};
const note=(bucket,key,kind,value,id)=>{
  const entry=(result[bucket][key]??={count:0,ids:[]});entry.count++;
  if(id!==undefined&&entry.ids.length<10&&!entry.ids.includes(id))entry.ids.push(id);
  const shapes=(result.shapes[kind]??=new Set());if(shapes.size<20)shapes.add(mask(value));
};
for await(const file of files(root)){
  const bytes=await readFile(file);result.filesScanned++;result.bytesScanned+=bytes.length;
  const text=bytes.toString('latin1'),rel=path.relative(root,file);
  for(const [kind,[pattern,keep]] of Object.entries(byteSignatures))for(const m of text.matchAll(pattern)){
    if(keep&&!keep(m))continue;
    note(attachment(file)?'attachmentFindings':'signatureHits',`${kind} ${rel}`,kind,m[0].trim());
  }
  const table=parts.get(file);if(!table)continue;
  result.rowPartsValidated++;
  for(const row of JSON.parse(bytes.toString('utf8'))){
    result.rowsValidated++;
    for(const [column,value] of Object.entries(row))for(const s of strings(value)){
      result.stringsChecked++;
      for(const [kind,found] of stringFindings(s))note(attachmentName(table,column)&&kind==='opaque-run'?'attachmentNameTokens':'stringHits',`${kind} ${table}.${column}`,kind,found,String(row.id??''));
    }
  }
}
result.shapes=Object.fromEntries(Object.entries(result.shapes).map(([k,s])=>[k,[...s]]));
result.scan=Object.keys(result.signatureHits).length||Object.keys(result.stringHits).length?'FAIL':result.filesScanned&&result.rowPartsValidated?'PASS':'ERROR';
result.secretValuesPrintedOrPersisted=false;
await writeFile(values.output??path.join(root,'secret-signatures.json'),JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify({root,scan:result.scan,files:result.filesScanned,bytes:result.bytesScanned,rowParts:result.rowPartsValidated,rows:result.rowsValidated,strings:result.stringsChecked,
  signatureHits:Object.fromEntries(Object.entries(result.signatureHits).map(([k,v])=>[k,v.count])),stringHits:Object.fromEntries(Object.entries(result.stringHits).map(([k,v])=>[k,{rows:v.count,ids:v.ids}])),
  attachmentFindings:Object.entries(result.attachmentFindings).reduce((n,[k,v])=>{const kind=k.split(' ')[0];n[kind]=(n[kind]||0)+v.count;return n;},{}),attachmentFindingFiles:new Set(Object.keys(result.attachmentFindings).map(k=>k.slice(k.indexOf(' ')+1))).size,
  attachmentNameTokens:Object.values(result.attachmentNameTokens).reduce((n,v)=>n+v.count,0)}));
if(result.scan!=='PASS')process.exitCode=1;
