import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../../platform/env'
import {hashToken} from '../../../platform/auth'
import {encryptToken,decryptToken} from '../../integrations/secrets'
import {auditStatement,type AuditEvent} from '../../audit/record'
import {matchingStep} from './totp'
import {spendRecoveryCode} from './recovery-codes'
import {b64url,fromB64url,relyingParty,verifyAssertion,WebAuthnError,type AssertionInput} from './webauthn'
import type {FactorMethod} from './state'
import {jsonResponse} from '../../../platform/json-response'

export interface Factor {id:string;user_id:string;kind:'totp'|'webauthn';label:string;secret_ciphertext:string|null;credential_id:string|null;public_key:string|null;algorithm:number|null;sign_count:number;last_step:number|null;created_at:number;confirmed_at:number|null;last_used_at:number|null}
const secretContext=(userId:string)=>`two-factor:${userId}`
export const sealTotpSecret=(env:Env,userId:string,secret:string)=>encryptToken(env,secretContext(userId),secret)
export const openTotpSecret=(env:Env,userId:string,sealed:string)=>decryptToken(env,secretContext(userId),sealed)

export async function confirmedFactors(db:D1Database,userId:string){
 return (await db.prepare('SELECT * FROM user_factors WHERE user_id=? AND confirmed_at IS NOT NULL ORDER BY created_at').bind(userId).all<Factor>()).results
}

/** The installation's own origin: WebAuthn binds credentials to it, never to a forwarded host. */
export function installationOrigin(env:Env,requestUrl:string){return relyingParty(String(env.APP_ORIGIN||new URL(requestUrl).origin))}

export async function webauthnChallenge(db:D1Database,userId:string,purpose:'register'|'assert'){
 const challenge=b64url(crypto.getRandomValues(new Uint8Array(32))),id=crypto.randomUUID()
 await db.batch([
  db.prepare('DELETE FROM webauthn_challenges WHERE user_id=? AND (purpose=? OR expires_at<?)').bind(userId,purpose,Date.now()),
  db.prepare('INSERT INTO webauthn_challenges(id,user_id,purpose,challenge,expires_at) VALUES(?,?,?,?,?)').bind(id,userId,purpose,challenge,Date.now()+5*60*1000),
 ])
 return challenge
}
/** Takes the challenge a client answered, once. */
export async function takeChallenge(db:D1Database,userId:string,purpose:'register'|'assert',clientDataJSON:unknown){
 let challenge:string
 try{challenge=JSON.parse(new TextDecoder().decode(fromB64url(clientDataJSON))).challenge}catch{return null}
 const row=await db.prepare('DELETE FROM webauthn_challenges WHERE user_id=? AND purpose=? AND challenge=? AND expires_at>? RETURNING challenge').bind(userId,purpose,String(challenge),Date.now()).first<{challenge:string}>()
 return row?.challenge??null
}

/** Runs statements that may be none (an account with no workspace has no log to write). */
export async function runAll(db:D1Database,statements:D1PreparedStatement[]){if(statements.length)await db.batch(statements)}
/** Every workspace the person belongs to records events about their own account. */
export async function accountAudit(db:D1Database,userId:string,event:Omit<AuditEvent,'projectId'>){
 const projects=(await db.prepare('SELECT project_id FROM memberships WHERE user_id=?').bind(userId).all<{project_id:string}>()).results
 return projects.map(({project_id})=>auditStatement(db,{...event,projectId:project_id}))
}

const LIMIT=5,WINDOW=15*60*1000
async function attemptKey(userId:string){return hashToken(`factor:${userId}`)}
/**
 * Five answers that are not accepted in fifteen minutes lock second-factor entry for the rest
 * of the window. Each answer claims its attempt before it is checked, so parallel guesses
 * cannot outrun the count; an accepted answer clears it.
 */
async function claimAttempt(db:D1Database,userId:string){
 const now=Date.now()
 const row=await db.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END RETURNING failures').bind(await attemptKey(userId),now,now-WINDOW,now-WINDOW).first<{failures:number}>()
 return row!.failures<=LIMIT
}
const clearFailures=async(db:D1Database,userId:string)=>{await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(await attemptKey(userId)).run()}

export interface Proof {code?:unknown;recoveryCode?:unknown;credential?:AssertionInput}
/**
 * Proves the person's second factor with a TOTP code (each time step once), an unused
 * recovery code, or a WebAuthn assertion. A wrong, replayed or spent answer is refused,
 * counted against the limit and audited.
 */
export async function proveFactor(env:Env,userId:string,proof:Proof,requestUrl:string,source:'dashboard'|'api'='dashboard'):Promise<FactorMethod>{
 const refuse=async(reason:string,status:400|401|429=401)=>{
  await runAll(env.DB,await accountAudit(env.DB,userId,{category:'auth',action:'two_factor.refused',outcome:'refused',actor:{type:'user',id:userId},source,detail:{reason}}))
  throw new HTTPException(status,{res:jsonResponse({error:status===429?'Too many incorrect codes. Wait 15 minutes, then try again.':'That code or key was not accepted.',code:reason},status)})
 }
 if(!await claimAttempt(env.DB,userId))return refuse('rate_limited',429)
 const now=Date.now()
 if(proof.recoveryCode!==undefined){
  if(await spendRecoveryCode(env.DB,userId,proof.recoveryCode,now)){await clearFailures(env.DB,userId);return 'recovery'}
  return refuse('recovery_code_invalid')
 }
 if(proof.credential!==undefined){
  const credential=proof.credential,expected=installationOrigin(env,requestUrl)
  const factor=typeof credential?.id==='string'?await env.DB.prepare("SELECT * FROM user_factors WHERE user_id=? AND kind='webauthn' AND credential_id=? AND confirmed_at IS NOT NULL").bind(userId,credential.id).first<Factor>():null
  const challenge=await takeChallenge(env.DB,userId,'assert',credential?.response?.clientDataJSON)
  if(!factor||!challenge)return refuse('passkey_invalid')
  try{
   const {signCount}=await verifyAssertion(credential,{publicKey:factor.public_key!,algorithm:factor.algorithm!,signCount:factor.sign_count},{challenge,rpId:expected.id,origin:expected.origin})
   await env.DB.prepare('UPDATE user_factors SET sign_count=?,last_used_at=? WHERE id=?').bind(signCount,now,factor.id).run()
   await clearFailures(env.DB,userId);return 'webauthn'
  }catch(error){if(!(error instanceof WebAuthnError))throw error;return refuse('passkey_invalid')}
 }
 for(const factor of (await confirmedFactors(env.DB,userId)).filter(factor=>factor.kind==='totp')){
  // A key restored under a different installation key cannot be opened: that app no longer proves anything.
  const secret=await openTotpSecret(env,userId,factor.secret_ciphertext!).catch(()=>null)
  if(!secret)continue
  const step=await matchingStep(secret,proof.code,factor.last_step,now)
  if(step===null)continue
  // Claiming the step atomically refuses the same code twice, including two racing requests.
  const claimed=await env.DB.prepare('UPDATE user_factors SET last_step=?,last_used_at=? WHERE id=? AND (last_step IS NULL OR last_step<?)').bind(step,now,factor.id,step).run()
  if(claimed.meta.changes===1){await clearFailures(env.DB,userId);return 'totp'}
 }
 return refuse('code_invalid')
}
