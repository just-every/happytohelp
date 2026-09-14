#!/usr/bin/env node
import {registerHooks} from 'node:module'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}})
const {planImport,importLegacy}=await import('../src/modules/legacy-import/importer.ts')
const args=process.argv.slice(2),file=args[args.indexOf('--file')+1];if(!args.includes('--file')||!file||args.includes('--remote'))throw new Error('Usage: node scripts/import-legacy.mjs --file explicit-export.json [--apply] [--persist-to path]. Local only; default plans without writing.')
const bundle=JSON.parse(await readFile(file,'utf8'))
if(!args.includes('--apply')){const plan=await planImport(bundle);console.log(JSON.stringify({id:plan.id,...plan.summary},null,2))}
else{const {getPlatformProxy}=await import('wrangler'),path=args.includes('--persist-to')?args[args.indexOf('--persist-to')+1]:'.wrangler/state';const proxy=await getPlatformProxy({persist:{path}});try{console.log(JSON.stringify(await importLegacy(proxy.env,bundle),null,2))}finally{await proxy.dispose()}}
