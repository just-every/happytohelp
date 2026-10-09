import type {Context} from 'hono'
import type {AppEnv} from '../../platform/env'
import {hashToken} from '../../platform/auth'
import {canonical,fail,installation,scopes,targetParts,text} from './common'
/** Validate a delegation request against the registered client; shared by the consent form and its page data. */
export async function consentRequest(c:Context<AppEnv>,b:any){installation(c.env);const clientId=text(b.client_id,200),projectId=text(b.account_id,200);const client=await c.env.DB.prepare('SELECT * FROM edition_clients WHERE id=? AND project_id=? AND enabled=1').bind(clientId,projectId).first<any>();if(!client||client.redirect_uri!==b.redirect_uri)fail('INVALID_REQUEST');if(b.response_type!=='code'||b.code_challenge_method!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(b.code_challenge))fail('INVALID_REQUEST');const scope=Array.isArray(b.scope)?b.scope:String(b.scope).split(' ');if(!scope.length||scope.some((s:string)=>!scopes.includes(s as any)))fail('INVALID_REQUEST');let targets=b.targets;if(typeof targets==='string'){try{targets=JSON.parse(targets)}catch{fail('INVALID_REQUEST')}}if(!Array.isArray(targets)||!targets.length||targets.length>100)fail('INVALID_REQUEST');for(const target of targets){text(target,500);targetParts(target,projectId)}return {client_id:clientId,account_id:projectId,redirect_uri:client.redirect_uri,origin:client.origin,response_type:'code',state:text(b.state,1000),code_challenge:b.code_challenge,code_challenge_method:'S256',scope:[...new Set(scope)] as string[],targets:[...new Set(targets)] as string[]}}

/** The consent form is bound to the signed-in session, the issue time and the exact request. */
export const consentToken=(sessionToken:string,issued:number,request:unknown)=>hashToken(sessionToken+':'+issued+':'+canonical(request))
