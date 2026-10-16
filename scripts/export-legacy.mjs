#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {connectLegacy} from './legacy-export/mysql.mjs';
import {extractProject} from './legacy-export/extract.mjs';
import {hydrateObjects} from './legacy-export/attachments.mjs';
import {readBundle,writeBundle} from './legacy-export/files.mjs';
import {classifySnapshot} from './legacy-export/secrets.mjs';

const {values,positionals}=parseArgs({allowPositionals:true,options:{
  project:{type:'string'},revision:{type:'string'},'ai-model':{type:'string'},output:{type:'string'},input:{type:'string'},
  'objects-dir':{type:'string'},bucket:{type:'string'},region:{type:'string'},'mail-from-domain':{type:'string'},
  'max-row-bytes':{type:'string'},'max-object-bytes':{type:'string'},'max-json-bytes':{type:'string'},help:{type:'boolean'},
}});
if(values.help){console.log(`Read-only legacy HappyToHelp export (one project per snapshot):
  node scripts/export-legacy.mjs snapshot --project UUID --revision SOURCE_SHA --mail-from-domain DOMAIN [--ai-model MODEL] --output snapshot.json
  node scripts/export-legacy.mjs attachments --input snapshot.json --objects-dir copied-bucket --output import.json
  node scripts/export-legacy.mjs attachments --input snapshot.json --bucket BUCKET --region REGION --output import.json

Snapshot requires LEGACY_MYSQL_HOST, LEGACY_MYSQL_DATABASE, LEGACY_MYSQL_USER, LEGACY_MYSQL_PASSWORD;
optional LEGACY_MYSQL_PORT (3306) and LEGACY_MYSQL_SSL_CA (verified TLS).
S3 requires explicitly scoped LEGACY_AWS_ACCESS_KEY_ID, LEGACY_AWS_SECRET_ACCESS_KEY, optional LEGACY_AWS_SESSION_TOKEN.
No dotenv, AWS profiles or live discovery. Output paths must not already exist. See docs/LEGACY-EXPORT.md.`);process.exit(0);}
const limit=name=>{if(values[name]===undefined)return undefined;const n=Number(values[name]);if(!Number.isSafeInteger(n)||n<=0)throw Error(`Invalid --${name}`);return n;};
try {
  if(positionals.length!==1||!['snapshot','attachments'].includes(positionals[0])||!values.output)throw Error('Use --help for the two explicit steps');
  let bundle;
  if(positionals[0]==='snapshot'){
    if(!values.project||!values.revision)throw Error('Snapshot requires --project and --revision');
    const connection=await connectLegacy();
    try{bundle=await extractProject(connection,{projectId:values.project,revision:values.revision,aiModel:values['ai-model'],mailFromDomain:values['mail-from-domain'],maxBytes:limit('max-row-bytes')});}
    finally{await connection.end();}
  }else{
    if(!values.input)throw Error('Attachments requires --input');
    bundle=await readBundle(values.input,limit('max-json-bytes'));
    if(bundle.format!=='happytohelp-legacy-v1')throw Error('Not a legacy snapshot');
    classifySnapshot(bundle);
    bundle=await hydrateObjects(bundle,{directory:values['objects-dir'],bucket:values.bucket,region:values.region,maxBytes:limit('max-object-bytes'),maxJsonBytes:limit('max-json-bytes')});
  }
  await writeBundle(values.output,bundle,limit('max-json-bytes'));
  console.log(JSON.stringify({output:values.output,project:bundle.source.projectId,rows:bundle.source.rowCounts,objects:bundle.objects?.length??0}));
}catch(error){
  // Driver/provider errors may contain hostnames, SQL and credentials. Print only known tool errors.
  if(error.code) console.error(`Legacy export failed (${error.code}); no completed artifact was published.`);
  else console.error(error.message);
  process.exitCode=1;
}
