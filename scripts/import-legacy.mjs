import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {importPackage} from './legacy-export/import-package.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {planImport,importLegacy}=await import('../src/modules/legacy-import/importer.ts');
const {tableOrder}=await import('../src/modules/legacy-import/mapping.ts');
const args=process.argv.slice(2),file=args[args.indexOf('--file')+1];
if(!args.includes('--file')||!file||args.includes('--remote'))throw Error('Usage: node scripts/import-legacy.mjs --file explicit-export.json-or-directory [--apply] [--persist-to path]. Local only; default plans without writing.');
const directory=(await stat(file)).isDirectory(),bundle=directory?null:JSON.parse(await readFile(file,'utf8'));
if(!args.includes('--apply')){const result=directory?await importPackage(file,null,{planImport,importLegacy,tableOrder}):await planImport(bundle);console.log(JSON.stringify(directory?result:{id:result.id,...result.summary},null,2));}
else{const {getPlatformProxy}=await import('wrangler'),path=args.includes('--persist-to')?args[args.indexOf('--persist-to')+1]:'.wrangler/state';const proxy=await getPlatformProxy({remoteBindings:false,persist:{path:join(path,'v3')}});try{console.log(JSON.stringify(directory?await importPackage(file,proxy.env,{planImport,importLegacy,tableOrder}):await importLegacy(proxy.env,bundle),null,2));}finally{await proxy.dispose();}}
