const sections=new Set(['install','widget-hash','javascript-api','javascript-options','values','safety'])
/** Preserve links in installation instructions without reviving old marketing pages. */
export function legacyDocumentationResponse(request:Request):Response|null {
 const url=new URL(request.url),match=/^\/resources\/([^/]+)\/?$/.exec(url.pathname)
 if(!['GET','HEAD'].includes(request.method)||!match||!sections.has(match[1]))return null
 return new Response(null,{status:308,headers:{Location:`/docs/legacy-entry-points#${match[1]}`,'Cache-Control':'no-cache'}})
}
