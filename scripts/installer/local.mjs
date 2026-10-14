import {localInstaller} from '@runeditrun/rer/local-installer';
import {developmentTarget,previewTarget} from '@runeditrun/rer/operator-installer';
import {installOperator} from '@runeditrun/rer/operator-install';
import {selectLocalState} from '@runeditrun/rer/local/state';
import {commandAdapter as createCommandAdapter} from '@runeditrun/rer/adapter';
import {ownerDeploy} from '@runeditrun/rer/deploy';
import {localPortability} from '@runeditrun/rer/portability';
import {localOwner,nativeOwner,prepareNativeLocal} from './native-local.mjs';
import {archivePolicy} from './portability-policy.mjs';
import * as model from './ui/seed.mjs';

const environment=context=>({...process.env,...context.vars,APP_ORIGIN:context.origin,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_INCLUDE_PROCESS_ENV:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',X_LOCAL_EXPLORER:'false'});
const preview=context=>{
 const [command,args,options]=previewTarget(context);
 return [command,args,{...options,env:{...environment(context),...options.env,APP_ORIGIN:context.origin,RER_ORIGIN_KEY:'APP_ORIGIN'}}];
};
const dev=async context=>{
 const env={...environment(context),RER_DEV_ORIGIN:context.origin};
 await context.run('Building development assets','pnpm',['run','build:assets'],{step:'build',cwd:context.root,signal:context.signal,env});
 const [command,args,options]=developmentTarget(context);
 return [command,args,{...options,env:{...env,...options.env,APP_ORIGIN:context.origin}}];
};
export const adapter=localInstaller({
 node:'22.20.0',features:{...model.features,hosting:false,github:false},
 guard:async({root})=>{await selectLocalState(root);},prepare:prepareNativeLocal,
 // Add only missing keys: settings saved by 0.3 (setup token, local mail, optional
 // provider settings) are kept byte-for-byte while this release's local keys are added.
 secrets:{originKey:'APP_ORIGIN',values:context=>({APP_ORIGIN:context.origin,H2H_LOCAL:'true',EMAIL_PROVIDER:'development',EMAIL_FROM:'support@localhost.test'})},
 build:['pnpm',['run','build:app']],
 migrate:['pnpm',['exec','wrangler','d1','migrations','apply','DB','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc']],
 start:preview,owner:nativeOwner,localOwner,signIn:{magicLink:'/api/identity/magic-link',emailKey:'OWNER_EMAIL',returnTo:'/setup'},
});
export const install=(root,input,store,onApp,signal)=>installOperator(root,input,store,onApp,signal,adapter.hooks);
const transfer=localPortability({database:'DB',buckets:{FILES:'FILES'},policy:archivePolicy,transient:['ConversationSocket connections (messages are in D1)','queue execution leases','development outbox','active sessions and one-use sign-in links','GitHub and integration credentials','local computer pairing, grants and job execution records']});
const portability=Object.fromEntries(['export','import'].map(verb=>[verb,async context=>{await context.store.run('Collecting local migrations',process.execPath,['scripts/migrations.mjs'],{cwd:context.root,signal:context.signal});return transfer[verb](context);} ]));
export const commandAdapter=createCommandAdapter(adapter,{
 generatedOutputs:['.generated','migrations/core','delivery-artifact','public/downloads','public/widget.js'],
 product:model.product.name,dev,preview,verify:['pnpm',['run','verify:app']],deploy:ownerDeploy('deploy.json',adapter),
 portability,
 setup:{manifestFile:'rer-setup.json'},browserModule:'scripts/installer/ui/seed.mjs',input:{names:{email:'OWNER_EMAIL',name:'OWNER_NAME'},defaults:async root=>({target:'local',EMAIL_PROVIDER:'later'})},
 localPrerequisites:async({vars})=>vars.H2H_LOCAL==='true'&&vars.EMAIL_PROVIDER==='development',
});
