import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {refusals} from './admission-inputs.mjs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const {uploadIdentities}=await import('../../src/modules/move-in/identities.ts');
for(const [vendor,name,body,code,row,pointer,artifact=name] of refusals())test(`${vendor} ${name}: ${code} refuses the whole upload`,async()=>{
 await assert.rejects(()=>uploadIdentities('p',vendor,name,typeof body==='string'?new TextEncoder().encode(body):body),error=>{assert.equal(error.code,code);assert.deepEqual(error.diagnostic,{code,location:{artifact,row,pointer}});return true});
});
