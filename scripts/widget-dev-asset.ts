import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import type {Plugin} from 'vite'
import {widgetAssetOrigin} from '../src/modules/widget/asset-origin'

/** Vite's public files bypass Worker fetch in dev; keep the script's boot path equivalent. */
export function widgetDevAsset(origin:string|undefined):Plugin {
 return {name:'widget-canonical-dev-origin',configureServer(server){
  if(!origin)return
  server.middlewares.use(async(req,res,next)=>{
   if(req.url?.split('?')[0]!=='/widget.js'||!['GET','HEAD'].includes(req.method||''))return next()
   try {
    const bytes=await readFile(join(server.config.root,'public/widget.js'))
    const response=widgetAssetOrigin(new Request(origin+'/widget.js'),new Response(bytes,{headers:{'Content-Type':'text/javascript; charset=utf-8'}}),origin)
    res.statusCode=response.status
    response.headers.forEach((value,name)=>res.setHeader(name,value))
    if(req.method==='HEAD'){await response.body?.cancel();res.end()}else res.end(await response.text())
   }catch(error){next(error)}
  })
 }}
}
