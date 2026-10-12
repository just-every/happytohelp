import {fileURLToPath} from 'node:url';
import {withoutLocalVariables} from './base-onboarding/local/build.mjs';
import {buildEnvironment} from './base-onboarding/local/environment.mjs';
import {createCommands} from './base-onboarding/commands.mjs';
import {privateDirectory} from './base-onboarding/private-files.mjs';
import {secretNames,variableNames} from './deployment/environment.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const bindings=new RegExp(`^(?:${[...secretNames,...variableNames,'APP_ORIGIN','H2H_LOCAL'].join('|')})$`);
const cancellation=new AbortController();
const stop=()=>cancellation.abort(new Error('Build stopped.'));
process.on('SIGINT',stop);process.on('SIGTERM',stop);
const store=await createCommands(await privateDirectory(root,['.seed','installer','build']),{logs:[]});
store.setCommandSignal(cancellation.signal);
try{
 await withoutLocalVariables(root,async({secrets})=>{
  store.addSecrets(secrets);
  const env=buildEnvironment(bindings);
  for(const [command,args] of [[process.execPath,['scripts/migrations.mjs']],['pnpm',['run','build:assets']],['pnpm',['exec','vite','build']],[process.execPath,['scripts/delivery/build.mjs','--clean']]]){
   await store.run('Building application',command,args,{cwd:root,env,signal:cancellation.signal});
  }
 });
}finally{await store.closeCommands();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
