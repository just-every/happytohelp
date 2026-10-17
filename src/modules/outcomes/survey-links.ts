import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import type {Survey} from './survey-store'
export const surveySigningConfigured=(env:Env):env is Env&{INBOUND_EMAIL_TOKEN:string}=>typeof env.INBOUND_EMAIL_TOKEN==='string'&&env.INBOUND_EMAIL_TOKEN.length>=16
async function signingKey(env:Env){
 if(!surveySigningConfigured(env))throw new HTTPException(503,{message:'Survey signing requires INBOUND_EMAIL_TOKEN with at least 16 characters'})
 const secret=env.INBOUND_EMAIL_TOKEN
 return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
}
const payload=(row:Survey,revision:number)=>new TextEncoder().encode(JSON.stringify(['csat-v1',row.id,row.project_id,row.resolution_id,row.contact_id,row.recipient,row.expires_at,revision]))
export async function surveyToken(env:Env,row:Survey){
 const signature=await crypto.subtle.sign('HMAC',await signingKey(env),payload(row,row.token_revision))
 return `${row.id}.${row.token_revision}.${Array.from(new Uint8Array(signature),byte=>byte.toString(16).padStart(2,'0')).join('')}`
}
export async function verifySurveyToken(env:Env,token:string){
 const parts=/^([a-zA-Z0-9-]{1,80})\.(\d{1,9})\.([a-f0-9]{64})$/.exec(token)
 if(!parts)throw new HTTPException(404,{message:'Survey link is unavailable'})
 const row=await env.DB.prepare('SELECT * FROM csat_surveys WHERE id=?').bind(parts[1]).first<Survey>()
 const revision=Number(parts[2])
 if(!row||!await crypto.subtle.verify('HMAC',await signingKey(env),Uint8Array.from(parts[3].match(/../g)!,byte=>parseInt(byte,16)),payload(row,revision)))throw new HTTPException(404,{message:'Survey link is unavailable'})
 return {row,revision}
}
export async function surveyURL(env:Env,row:Survey){
 if(typeof env.APP_ORIGIN!=='string')throw new HTTPException(503,{message:'Application origin is not configured'})
 return new URL('/api/outcomes/surveys/'+await surveyToken(env,row),env.APP_ORIGIN).href
}
