#!/usr/bin/env node
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const usage='Usage: node scripts/import-legacy.mjs (--file export.json | --package package-directory) [--apply [--persist-to path | --remote --database D1-NAME --bucket R2-NAME]] [--expect-manifest-sha256 HEX] [--exclude-table TABLE ...] [--concurrency N]. Without --apply it validates and plans without writing.'
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);if(i<0)return undefined;const v=args[i+1];if(!v||v.startsWith('--'))throw new Error(usage);return v}
const file=value('--file'),pkg=value('--package'),remote=args.includes('--remote'),apply=args.includes('--apply'),excludeTables=args.flatMap((arg,i)=>arg==='--exclude-table'?[args[i+1]]:[])
if(excludeTables.some(table=>!table||table.startsWith('--'))||(excludeTables.length&&!pkg))throw new Error(usage)
if(!file===!pkg||(remote&&!apply)||(remote&&args.includes('--persist-to'))||(file&&remote))throw new Error(usage)
const {planImport,importLegacy}=await import('../src/modules/legacy-import/importer.ts')
const {tableOrder}=await import('../src/modules/legacy-import/mapping.ts')
const relationships=await import('../src/modules/legacy-import/relationships.ts')
const types=await import('../src/modules/legacy-import/types.ts')
const {importPackage}=await import('./legacy-import/import-package.mjs')
const {localTarget,remoteTarget}=await import('./legacy-import/target.mjs')
const concurrency=Number(value('--concurrency')??1);if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>16)throw new Error(usage)
// Progress is one JSON line per step or chunk on stderr: counts, ids and timings only.
const progress=line=>process.stderr.write(JSON.stringify({at:new Date().toISOString(),...line})+'\n')
async function run(target){
 if(pkg)return importPackage(pkg,target,{planImport,importLegacy,tableOrder,relationships,types},{expectManifestSha256:value('--expect-manifest-sha256'),excludeTables,concurrency,progress})
 const bundle=JSON.parse(await readFile(file,'utf8'));if(target)return importLegacy(target.env,bundle)
 const plan=await planImport(bundle);return {id:plan.id,...plan.summary}
}
if(!apply)console.log(JSON.stringify(await run(null),null,2))
else{
 const target=remote?await remoteTarget({database:value('--database'),bucket:value('--bucket')}):await localTarget(value('--persist-to')??'.wrangler/state')
 progress({step:'target',target:target.label})
 try{console.log(JSON.stringify(await run(target),null,2))}finally{await target.close()}
}
