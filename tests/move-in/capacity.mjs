import {spawn} from 'node:child_process';
const failures=[];
for(const vendor of ['zendesk','intercom','helpscout']){
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,['tests/move-in/runtime.mjs'],{stdio:'inherit',env:{...process.env,MOVE_IN_VENDOR:vendor,MOVE_IN_COUNT:'1000'}});child.on('error',error=>resolve({error:error.message}));child.on('exit',(code,signal)=>resolve({code,signal}))});
 console.log(JSON.stringify({proof:'move-in-capacity-command',vendor,...result}));if(result.code!==0)failures.push({vendor,...result});
}
if(failures.length)throw new Error(`Capacity acceptance failed: ${JSON.stringify(failures)}`);
