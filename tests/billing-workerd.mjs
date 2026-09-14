import {createServer} from 'node:net';
const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));const origin=`http://127.0.0.1:${port}`;
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn,execFileSync} from 'node:child_process'
const temp=mkdtempSync(join(tmpdir(),'h2h-workerd-'));let child;
try{
 execFileSync('node_modules/.bin/esbuild',['tests/billing-worker.ts','--bundle','--format=esm','--platform=browser','--external:node:*','--loader:.sql=text',`--outfile=${temp}/worker.js`],{stdio:'pipe'});
 writeFileSync(join(temp,'wrangler.json'),JSON.stringify({name:'h2h-billing-test',main:'worker.js',compatibility_date:'2026-09-08',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'test',database_id:'test'}],r2_buckets:[{binding:'FILES',bucket_name:'test'}]}));
 child=spawn(resolve('node_modules/.bin/wrangler'),['dev','--config',join(temp,'wrangler.json'),'--port',String(port),'--persist-to',join(temp,'state')],{stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 let ready=false;for(let i=0;i<100;i++){try{await fetch(origin+'/');ready=true;break}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready)throw new Error(logs);
 const response=await fetch(origin+'/test');const result=await response.json();console.log(result);if(!response.ok)throw new Error(JSON.stringify(result));
}finally{child?.kill('SIGTERM');if(child)await new Promise(r=>child.once('exit',r));rmSync(temp,{recursive:true,force:true})}
