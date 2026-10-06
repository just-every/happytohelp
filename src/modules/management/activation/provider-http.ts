import type {Probe} from './types'
export class ProbeFailure extends Error {
 readonly probe:Probe
 constructor(probe:Probe){super(probe.detail);this.probe=probe}
}
/** Fixed provider URLs only; neither provider bodies nor exceptions can expose keys. */
export async function providerJson(url:string,headers:Record<string,string>) {
 let response:Response
 try { response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(10000)}) }
 catch { throw new ProbeFailure({state:'unknown',detail:'Provider status could not be reached. Check again; no message or generation was replayed.'}) }
 if(!response.ok)throw new ProbeFailure({state:response.status===401?'failed':response.status===403?'unavailable':response.status===404?'failed':'unknown',detail:response.status===401?'Provider rejected the installed key. Replace it in installation secrets.':response.status===403?'The installed key cannot read this provider status. Grant the required read permission, then check again.':`Provider status returned HTTP ${response.status}. Check the selected account and configuration.`})
 try { const body=await response.json();if(!body||typeof body!=='object')throw new Error();return body as any }
 catch {throw new ProbeFailure({state:'unknown',detail:'Provider returned an unrecognized status response.'})}
}
export const bearer=(key:unknown)=>({Authorization:`Bearer ${String(key)}`})
