import {createRequire} from 'node:module'
import {dirname,join} from 'node:path'
import {createServer,connect} from 'node:net'
import {randomUUID} from 'node:crypto'

// A TCP fault probe, never an application substitute. Both sides of the relay
// are real workerd sockets: Wrangler's installed ProxyWorker and the emitted
// application. A selected write is dropped before any bytes reach the app.
export async function proxyFaultProbe(origin){
 const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler'))
 const {Miniflare,convertV4MiniflareOptions,Response}=wranglerRequire('miniflare')
 const target=new URL(origin),connections=new Set(),errors=[]
 let dropNext=false,dropped=0,forwarded=0,proxy
 const relay=createServer(client=>{
  connections.add(client);client.once('close',()=>connections.delete(client))
  const upstream=connect(Number(target.port),target.hostname);connections.add(upstream);upstream.once('close',()=>connections.delete(upstream))
  client.on('error',()=>{});upstream.on('error',()=>client.destroy());upstream.pipe(client)
  client.on('data',bytes=>{
   if(dropNext){dropNext=false;dropped++;client.resetAndDestroy();upstream.destroy();return}
   forwarded+=bytes.length;upstream.write(bytes)
  })
  client.once('end',()=>upstream.end());client.once('close',()=>upstream.destroy())
 })
 await new Promise((done,fail)=>{relay.once('error',fail);relay.listen(0,'127.0.0.1',done)})
 const close=async()=>{await proxy?.dispose();for(const socket of connections)socket.destroy();await new Promise(done=>relay.close(done))}
 try{
  const secret=randomUUID(),modulePath=join(dirname(require.resolve('wrangler')),'ProxyWorker.js')
  proxy=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,workers:[{
   name:'InstalledWranglerProxyFaultProbe',compatibilityDate:'2023-12-18',compatibilityFlags:['nodejs_compat'],
   modulesRoot:dirname(modulePath),modules:[{type:'ESModule',path:modulePath}],
   durableObjects:{DURABLE_OBJECT:{className:'ProxyWorker',unsafePreventEviction:true}},unsafeEphemeralDurableObjects:true,
   bindings:{PROXY_CONTROLLER_AUTH_SECRET:secret},serviceBindings:{PROXY_CONTROLLER:async request=>{errors.push(await request.json());return new Response(null,{status:204})}},
   cacheAPI:false,
  }]}))
  const url=await proxy.ready
  await proxy.dispatchFetch(new URL('/cdn-cgi/ProxyWorker/play',url),{headers:{Authorization:secret},cf:{hostMetadata:{type:'play',proxyData:{userWorkerUrl:{protocol:'http:',hostname:'127.0.0.1',port:String(relay.address().port)}}}}})
  return {origin:String(url).replace(/\/$/,''),errors,drop(){dropNext=true},get dropped(){return dropped},get forwarded(){return forwarded},close}
 }catch(error){await close();throw error}
}
