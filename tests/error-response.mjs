import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

await mkdir('.wrangler',{recursive:true});
const directory=await mkdtemp(resolve('.wrangler/error-response-'));
after(()=>rm(directory,{recursive:true,force:true}));
const outfile=join(directory,'app.mjs');
await build({entryPoints:['src/app.ts'],bundle:true,packages:'external',format:'esm',platform:'node',outfile,logLevel:'silent'});
const {app}=await import(pathToFileURL(outfile));

test('an early application error finishes the request body before returning its rejection',async()=>{
 let pulls=0;
 const body=new ReadableStream({pull(controller){pulls++;if(pulls===1)controller.enqueue(new Uint8Array([0,1,255]));else controller.close();}},{highWaterMark:0});
 const request=new Request('https://example.test/api/conversations/absent/media',{method:'POST',body,duplex:'half'});
 // Authentication fails before any database operation or media parsing.
 const response=await app.fetch(request,{});
 assert.equal(response.status,401);
 assert.deepEqual(await response.json(),{error:'Authentication required'});
 assert.equal(request.bodyUsed,true,'the request must be consumed before the response can end its lifetime');
 assert.equal(pulls,2,'the complete stream, including EOF, must be read');
});
