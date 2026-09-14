import {mkdtempSync,writeFileSync,rmSync,readdirSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawn,execFileSync} from 'node:child_process'
import {createServer} from 'node:net'
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));const origin=`http://127.0.0.1:${port}`;
const temp=mkdtempSync(join(tmpdir(),'h2h-deleted-background-'));let child;
try{
 const migrationPath=join(temp,'migrations.json');writeFileSync(migrationPath,JSON.stringify(readdirSync('migrations').filter(name=>name.endsWith('.sql')).sort().map(name=>({name,statements:splitSql(readFileSync('migrations/'+name,'utf8'))}))));
 execFileSync('node_modules/.bin/esbuild',['tests/deleted-background-worker.ts','--bundle','--format=esm','--platform=node','--loader:.sql=text',`--alias:migration-fixtures=${migrationPath}`,`--outfile=${temp}/worker.js`],{stdio:'pipe'});
 writeFileSync(join(temp,'wrangler.json'),JSON.stringify({name:'h2h-deleted-background-test',main:'worker.js',compatibility_date:'2026-09-08',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'test',database_id:'test'}],r2_buckets:[{binding:'FILES',bucket_name:'test'}]}));
 child=spawn(resolve('node_modules/.bin/wrangler'),['dev','--config',join(temp,'wrangler.json'),'--port',String(port),'--persist-to',join(temp,'state')],{stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(origin+'/')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}if(!ready)throw new Error(logs);
 const response=await fetch(origin+'/test');const raw=await response.text();let result;try{result=JSON.parse(raw)}catch{throw new Error(raw+'\n'+logs)}console.log(result);if(!response.ok)throw new Error(JSON.stringify(result));
}finally{child?.kill('SIGTERM');if(child)await new Promise(r=>child.once('exit',r));rmSync(temp,{recursive:true,force:true})}

// Statement splitter tracks quoted strings/comments and trigger BEGIN/CASE blocks.
function splitSql(source){
 const statements=[];let start=0,quote=null,line=false,block=false,word='',trigger=false,depth=0;
 const token=()=>{if(!word)return;const value=word.toUpperCase();if(value==='TRIGGER')trigger=true;if(trigger&&(value==='BEGIN'||value==='CASE'))depth++;if(trigger&&value==='END')depth--;word=''};
 for(let i=0;i<source.length;i++){const c=source[i],next=source[i+1];if(line){if(c==='\n')line=false;continue}if(block){if(c==='*'&&next==='/'){block=false;i++}continue}if(quote){if(c===quote){if(next===quote)i++;else quote=null}continue}if(c==='-'&&next==='-'){token();line=true;i++;continue}if(c==='/'&&next==='*'){token();block=true;i++;continue}if(c==="'"||c==='"'||c==='`'){token();quote=c;continue}if(/[a-zA-Z_]/.test(c)){word+=c;continue}token();if(c===';'&&depth===0){const sql=source.slice(start,i+1).trim();if(sql)statements.push(sql);start=i+1;trigger=false}}
 if(source.slice(start).trim())statements.push(source.slice(start).trim());return statements;
}
