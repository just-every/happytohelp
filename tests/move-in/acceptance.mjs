import {spawn} from 'node:child_process';
// Preserve both capacity and independent browser exit statuses.
const failures=[];
for(const script of ['tests/move-in/capacity.mjs','tests/move-in/browser.mjs']){
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,[script],{stdio:'inherit',env:process.env});child.on('error',error=>resolve({error:error.message}));child.on('exit',(code,signal)=>resolve({code,signal}))});
 console.log(JSON.stringify({proof:'move-in-acceptance-command',script,...result}));if(result.code!==0)failures.push({script,...result});
}
if(failures.length)throw new Error(`Move in acceptance failed: ${JSON.stringify(failures)}`);
