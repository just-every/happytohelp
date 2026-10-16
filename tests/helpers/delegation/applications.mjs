import assert from 'node:assert/strict'
import {startApp,sha} from '../../journeys/kit/app.mjs'

// Connected applications on the real application with an installation id.
export async function applicationsApp(installation='test-installation'){
 const app=await startApp({bindings:{RER_INSTALLATION_ID:installation}})
 const run=(sql,...args)=>app.db.prepare(sql).bind(...args).run(),one=(sql,...args)=>app.first(sql,...args)
 // A browser form or JSON request with a session cookie, or an application's bearer request.
 const call=(path,{token,cookie,body,method=body?'POST':'GET',form,origin=app.origin,headers={}}={})=>app.request(path,{method,token,raw:true,headers:{...(cookie?{Cookie:'h2h_session='+cookie}:{}),...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json',Origin:origin}:{}),...headers},body:body?(form?new URLSearchParams(body).toString():JSON.stringify(body)):undefined})
 const session=(token,user,project,role,expires=Date.now()+86400000)=>run('INSERT INTO sessions VALUES(?,?,?,?,NULL,?,NULL)',sha(token),user,project,role,expires)
 return {app,run,one,call,session,close:()=>app.close()}
}

// The consent screen's data, approved or cancelled the way its form posts it.
export const decide=(call,page,decision,cookie,headers)=>call('/delegation/authorize',{cookie,form:true,headers,body:{decision,request:JSON.stringify(page.request),issued:String(page.issued),csrf:page.csrf}})
export async function consentPage(call,query,cookie){const response=await call('/delegation/authorize/request?'+query,{cookie});assert.equal(response.status,200,await response.clone().text());return (await response.json()).data}
export const challengeOf=async verifier=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url')
