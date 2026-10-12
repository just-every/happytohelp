import {createServer} from 'node:net';
import {createRuntime} from './emitted-runtime.mjs';

// Use the real local mail policy selected by rer setup. The generic emitted
// runtime keeps its unconfigured defaults for production/refusal tests.
export async function createLocalMailRuntime(){
 const socket=createServer();
 await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
 const port=socket.address().port;
 await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
 return createRuntime({port,inspectorPort:0,vars:{H2H_LOCAL:'true',APP_ORIGIN:`http://127.0.0.1:${port}`,EMAIL_PROVIDER:'development',EMAIL_FROM:'support@localhost.test'}});
}
