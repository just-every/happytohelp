export type TxtResolver=(name:string)=>Promise<string[]>
export const resolveTxt:TxtResolver=async name=>{
 const response=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw new Error('DNS resolver unavailable')
 const result=await response.json() as {Status:number;Answer?:Array<{type:number;data:string}>}
 if(result.Status===3)return []
 if(result.Status!==0)throw new Error('DNS lookup failed')
 return (result.Answer||[]).filter(a=>a.type===16).map(a=>[...a.data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m=>m[1].replace(/\\(.)/g,'$1')).join('')||a.data)
}
const domainPattern=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
/** Record presence, not sender verification or delivery. Selectors are provider-specific. */
export async function checkSenderDomain(domain:string,resolver:TxtResolver=resolveTxt,dkimSelector='resend'){
 domain=String(domain).trim().toLowerCase()
 if(!domainPattern.test(domain)||!/^[-a-z0-9_]{1,63}$/i.test(dkimSelector))throw new Error('Invalid sender domain or DKIM selector')
 const requests=[['SPF',domain,/^v=spf1(?:\s|$)/i],['DKIM',`${dkimSelector}._domainkey.${domain}`,/(?:^|;)\s*p\s*=\s*[^;\s]+/i],['DMARC',`_dmarc.${domain}`,/^v=DMARC1\s*;/i]] as const
 const records=await Promise.all(requests.map(async([record,name,pattern])=>{
  try{const values=await resolver(name),present=values.some(v=>pattern.test(v));return {record,name,status:present?'present' as const:'missing' as const,message:present?`${record} record found`:`Missing ${record} record at ${name}`}}
  catch{return {record,name,status:'unknown' as const,message:`Unable to check ${record} record at ${name}`}}
 }))
 return {domain,dkimSelector,ok:records.every(r=>r.status==='present'),records,missing:records.filter(r=>r.status==='missing').map(r=>r.record)}
}
