/** The unchanged js-host snippet must reach the installation's canonical API. */
export function widgetAssetOrigin(request:Request,response:Response,apiOrigin:unknown):Response {
 if(new URL(request.url).pathname!=='/widget.js' || request.method!=='GET' || !response.ok || typeof apiOrigin!=='string')return response
 let origin:URL
 try {origin=new URL(apiOrigin)} catch {return response}
 if(origin.origin!==apiOrigin || origin.protocol!=='https:' && !(origin.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(origin.hostname)))return response
 const prefix=`if(document.currentScript&&!document.currentScript.dataset.apiOrigin)document.currentScript.dataset.apiOrigin=${JSON.stringify(origin.origin)};\n`
 const headers=new Headers(response.headers)
 headers.delete('Content-Length');headers.delete('ETag');headers.delete('Content-Encoding')
 headers.set('Cache-Control','no-cache')
 const encoder=new TextEncoder(),reader=response.body?.getReader()
 return new Response(new ReadableStream({
  start(controller){controller.enqueue(encoder.encode(prefix))},
  async pull(controller){if(!reader){controller.close();return}const chunk=await reader.read();if(chunk.done){controller.close();reader.releaseLock()}else controller.enqueue(chunk.value)},
  cancel(reason){return reader?.cancel(reason)},
 }),{status:response.status,headers})
}
