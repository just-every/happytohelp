/** workers.dev serves Workers over HTTP; receiving mail needs a custom domain. */
export function inboundNeedsCustomDomain(address:unknown):boolean {
 if(typeof address!=='string')return false
 const domain=address.slice(address.lastIndexOf('@')+1).toLowerCase()
 return domain==='workers.dev'||domain.endsWith('.workers.dev')
}
