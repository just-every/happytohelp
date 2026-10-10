import {createRequire} from 'node:module'
import {join,dirname,relative,matchesGlob} from 'node:path'
import {readdir} from 'node:fs/promises'
import {unstable_getMiniflareWorkerOptions} from 'wrangler'

// Use Wrangler's own binding/assets translation and its locked Miniflare. The
// emitted application runs in workerd and is reached over its real HTTP socket.
// `wrangler dev` adds a second workerd with a pooled HTTP hop to this socket;
// a connection failure in that hop can fail a request before it reaches the app.
const require=createRequire(import.meta.url)
const wranglerRequire=createRequire(require.resolve('wrangler'))
const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=wranglerRequire('miniflare')
const [configPath,persist,port,inspectorPort]=process.argv.slice(2)
const {workerOptions,main,externalWorkers}=unstable_getMiniflareWorkerOptions(configPath)
// Miniflare 5 requires an explicit emitted module manifest. Discover modules
// using Wrangler's rules, keeping their paths relative to the emitted entry.
const {modulesRules,...options}=workerOptions,modulesRoot=dirname(main)
const modules=[]
for(const entry of await readdir(modulesRoot,{withFileTypes:true,recursive:true})){
 if(!entry.isFile())continue
 const path=join(entry.parentPath,entry.name),name=relative(modulesRoot,path)
 const rule=modulesRules.find(rule=>rule.include.some(glob=>matchesGlob(name,glob)))
 if(rule)modules.push({type:rule.type,path})
}
const runtime=new Miniflare(convertV4MiniflareOptions({
 host:'127.0.0.1',port:Number(port),
 ...(inspectorPort?{inspectorPort:Number(inspectorPort),inspectorHost:'127.0.0.1'}:{}),
 resourcePersistencePath:join(persist,'v3'),
 resourceTmpPath:join(persist,'tmp'),
 workers:[{...options,name:'happytohelp-native-isolated-test',modulesRoot,modules:[...modules.filter(module=>module.path===main),...modules.filter(module=>module.path!==main)]},...externalWorkers],
 logRequests:true,log:new Log(LogLevel.INFO),
}))
let closing=false
const close=async()=>{if(closing)return;closing=true;await runtime.dispose()}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{close().then(()=>process.exit(0),error=>{console.error(error);process.exit(1)})})
try{console.log('Native emitted workerd HTTP transport; no Wrangler development ProxyWorker');console.log('Ready on '+await runtime.ready)}catch(error){console.error(error);await close();process.exitCode=1}
