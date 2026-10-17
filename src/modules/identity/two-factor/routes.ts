import {Hono} from 'hono'
import type {Context} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv,Actor} from '../../../platform/env'
import {requireActor} from '../../../platform/auth'
import {requestSource} from '../../audit/record'
import {accountAudit,runAll,confirmedFactors,installationOrigin,proveFactor,sealTotpSecret,openTotpSecret,takeChallenge,webauthnChallenge,type Factor} from './factors'
import {issueRecoveryCodes,remainingRecoveryCodes} from './recovery-codes'
import {matchingStep,newTotpSecret,otpauthUri} from './totp'
import {b64url,verifyRegistration,WebAuthnError} from './webauthn'
import {pendingFactor,recentStepUp,sessionFactorStatement,SECOND_FACTORS,type FactorMethod} from './state'
import {requireStepUp} from './step-up'
import {provePassword} from './password-proof'
import {jsonResponse} from '../../../platform/json-response'

export const twoFactor=new Hono<AppEnv>()
const teammate=async(c:Context<AppEnv>)=>{const actor=await requireActor(c);if(actor.role==='contact')throw new HTTPException(403);return actor}
const label=(value:unknown,fallback:string)=>typeof value==='string'&&value.trim()?value.trim().slice(0,60):fallback
const publicFactor=(factor:Factor)=>({id:factor.id,kind:factor.kind,label:factor.label,created_at:factor.created_at,last_used_at:factor.last_used_at})

/**
 * Adding a factor is a credential install: it needs a recent step-up, the password for an account
 * without one. Otherwise a held session could enrol its own authenticator, then pass every later
 * step-up with it and end the account holder's other sessions.
 */
async function mayEnrol(c:Context<AppEnv>,actor:Actor){await requireStepUp(c,actor,'two_factor.enrol')}

/**
 * Stores a confirmed factor and proves it for this session. The first factor also
 * issues the ten recovery codes, and every other session of the account that has
 * not proven a second factor ends.
 */
async function finishEnrolment(c:Context<AppEnv>,actor:Actor,factor:{id:string;kind:'totp'|'webauthn'},write:D1PreparedStatement){
 const db=c.env.DB,now=Date.now(),first=!actor.security?.hasFactor
 const codes=first?await issueRecoveryCodes(db,actor.id,now):null
 await db.batch([
  write,
  ...(codes?.statements??[]),
  sessionFactorStatement(db,c.get('sessionHash'),actor.id,factor.kind,now),
  db.prepare(`UPDATE sessions SET revoked_at=? WHERE actor_id=? AND revoked_at IS NULL AND token_hash<>? AND token_hash NOT IN (SELECT token_hash FROM session_factors WHERE user_id=? AND method IN (${SECOND_FACTORS.map(()=>'?').join(',')}))`).bind(now,actor.id,c.get('sessionHash'),actor.id,...SECOND_FACTORS),
  ...await accountAudit(db,actor.id,{category:'auth',action:'two_factor.enrolled',actor:{type:'user',id:actor.id},source:requestSource(c),target:{type:'factor',id:factor.id},detail:{kind:factor.kind}}),
 ])
 return {factor:factor.id,recoveryCodes:codes?.codes??null}
}

twoFactor.get('/two-factor',async c=>{
 const actor=await teammate(c),factors=await confirmedFactors(c.env.DB,actor.id)
 c.header('Cache-Control','no-store')
 return c.json({factors:factors.map(publicFactor),recoveryCodesRemaining:factors.length?await remainingRecoveryCodes(c.env.DB,actor.id):0,
  pending:pendingFactor(actor.security!),required:actor.security!.required,stepUp:recentStepUp(actor.security!)})
})

twoFactor.post('/two-factor/totp',async c=>{
 const actor=await teammate(c);await mayEnrol(c,actor)
 const user=await c.env.DB.prepare('SELECT email FROM users WHERE id=?').bind(actor.id).first<{email:string}>()
 const secret=newTotpSecret(),id=crypto.randomUUID()
 await c.env.DB.batch([
  c.env.DB.prepare("DELETE FROM user_factors WHERE user_id=? AND kind='totp' AND confirmed_at IS NULL").bind(actor.id),
  c.env.DB.prepare("INSERT INTO user_factors(id,user_id,kind,label,secret_ciphertext,created_at) VALUES(?,?,'totp','Authenticator app',?,?)").bind(id,actor.id,await sealTotpSecret(c.env,actor.id,secret),Date.now()),
 ])
 c.header('Cache-Control','no-store')
 return c.json({factorId:id,secret,uri:otpauthUri(secret,user!.email)},201)
})

twoFactor.post('/two-factor/totp/confirm',async c=>{
 const actor=await teammate(c);await mayEnrol(c,actor)
 const body=await c.req.json().catch(()=>({})),factor=await c.env.DB.prepare("SELECT * FROM user_factors WHERE id=? AND user_id=? AND kind='totp' AND confirmed_at IS NULL").bind(String(body.factorId||''),actor.id).first<Factor>()
 if(!factor)throw new HTTPException(404,{message:'Start setting up the authenticator again.'})
 const step=await matchingStep(await openTotpSecret(c.env,actor.id,factor.secret_ciphertext!),body.code,null)
 if(step===null)throw new HTTPException(400,{res:jsonResponse({error:'That code did not match. Check the time on your phone and enter the current code.',code:'code_invalid'},400)})
 const now=Date.now()
 c.header('Cache-Control','no-store')
 return c.json(await finishEnrolment(c,actor,{id:factor.id,kind:'totp'},c.env.DB.prepare('UPDATE user_factors SET confirmed_at=?,last_step=?,last_used_at=?,label=? WHERE id=? AND confirmed_at IS NULL').bind(now,step,now,label(body.label,'Authenticator app'),factor.id)),201)
})

twoFactor.post('/two-factor/webauthn/options',async c=>{
 const actor=await teammate(c);await mayEnrol(c,actor)
 const user=await c.env.DB.prepare('SELECT email,name FROM users WHERE id=?').bind(actor.id).first<{email:string;name:string}>()
 const existing=(await confirmedFactors(c.env.DB,actor.id)).filter(factor=>factor.kind==='webauthn')
 const rp=installationOrigin(c.env,c.req.url)
 c.header('Cache-Control','no-store')
 return c.json({publicKey:{challenge:await webauthnChallenge(c.env.DB,actor.id,'register'),rp:{name:'HappyToHelp',id:rp.id},
  user:{id:b64url(new TextEncoder().encode(actor.id)),name:user!.email,displayName:user!.name},
  pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],timeout:120000,attestation:'none',
  authenticatorSelection:{residentKey:'preferred',userVerification:'preferred'},
  excludeCredentials:existing.map(factor=>({type:'public-key',id:factor.credential_id}))}})
})

twoFactor.post('/two-factor/webauthn',async c=>{
 const actor=await teammate(c);await mayEnrol(c,actor)
 const body=await c.req.json().catch(()=>({})),credential=body.credential
 const challenge=await takeChallenge(c.env.DB,actor.id,'register',credential?.response?.clientDataJSON)
 if(!challenge)throw new HTTPException(400,{message:'The security key request expired. Try again.'})
 const rp=installationOrigin(c.env,c.req.url)
 let verified
 try{verified=await verifyRegistration(credential,{challenge,origin:rp.origin,rpId:rp.id})}
 catch(error){if(error instanceof WebAuthnError)throw new HTTPException(400,{message:'The security key response could not be verified.'});throw error}
 if(await c.env.DB.prepare('SELECT 1 FROM user_factors WHERE credential_id=?').bind(verified.credentialId).first())throw new HTTPException(409,{message:'This security key is already registered.'})
 const id=crypto.randomUUID(),now=Date.now()
 return c.json(await finishEnrolment(c,actor,{id,kind:'webauthn'},c.env.DB.prepare("INSERT INTO user_factors(id,user_id,kind,label,credential_id,public_key,algorithm,sign_count,created_at,confirmed_at,last_used_at) VALUES(?,?,'webauthn',?,?,?,?,?,?,?,?)").bind(id,actor.id,label(body.label,'Passkey'),verified.credentialId,verified.publicKey,verified.algorithm,verified.signCount,now,now,now)),201)
})

twoFactor.delete('/two-factor/factors/:factorId',async c=>{
 const actor=await teammate(c);await requireStepUp(c,actor,'two_factor.remove')
 const factors=await confirmedFactors(c.env.DB,actor.id),factor=factors.find(item=>item.id===c.req.param('factorId'))
 if(!factor)throw new HTTPException(404)
 const last=factors.length===1
 if(last){
  const required=await c.env.DB.prepare(`SELECT p.name FROM memberships m JOIN projects p ON p.id=m.project_id JOIN project_settings ps ON ps.project_id=m.project_id LEFT JOIN member_roles mr ON mr.project_id=m.project_id AND mr.user_id=m.user_id LEFT JOIN project_roles pr ON pr.id=mr.role_key AND pr.project_id=m.project_id
   WHERE m.user_id=? AND EXISTS(SELECT 1 FROM json_each(ps.settings_json,'$.two_factor_roles') r WHERE r.value=CASE WHEN mr.role_key='collaborator' OR pr.base='collaborator' THEN 'collaborator' ELSE m.role END) LIMIT 1`).bind(actor.id).first<{name:string}>()
  if(required)throw new HTTPException(409,{message:`${required.name} requires two-factor sign-in, so you must keep at least one factor. Add another one first.`})
 }
 await c.env.DB.batch([
  c.env.DB.prepare('DELETE FROM user_factors WHERE id=? AND user_id=?').bind(factor.id,actor.id),
  ...(last?[c.env.DB.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(actor.id)]:[]),
  ...await accountAudit(c.env.DB,actor.id,{category:'auth',action:'two_factor.removed',actor:{type:'user',id:actor.id},source:requestSource(c),target:{type:'factor',id:factor.id},detail:{kind:factor.kind,last}}),
 ])
 return c.json({removed:true})
})

twoFactor.post('/two-factor/recovery-codes',async c=>{
 const actor=await teammate(c);await requireStepUp(c,actor,'two_factor.recovery_codes')
 if(!actor.security?.hasFactor)throw new HTTPException(409,{message:'Set up two-factor sign-in first.'})
 const {codes,statements}=await issueRecoveryCodes(c.env.DB,actor.id)
 await c.env.DB.batch([...statements,...await accountAudit(c.env.DB,actor.id,{category:'auth',action:'two_factor.recovery_codes_issued',actor:{type:'user',id:actor.id},source:requestSource(c)})])
 c.header('Cache-Control','no-store')
 return c.json({recoveryCodes:codes},201)
})

twoFactor.post('/two-factor/assertion-options',async c=>{
 const actor=await teammate(c),keys=(await confirmedFactors(c.env.DB,actor.id)).filter(factor=>factor.kind==='webauthn')
 if(!keys.length)throw new HTTPException(404,{message:'No passkey or security key is set up for this account.'})
 c.header('Cache-Control','no-store')
 return c.json({publicKey:{challenge:await webauthnChallenge(c.env.DB,actor.id,'assert'),rpId:installationOrigin(c.env,c.req.url).id,timeout:120000,userVerification:'preferred',allowCredentials:keys.map(factor=>({type:'public-key',id:factor.credential_id}))}})
})

/** Finishes a sign-in, or steps up, with a second factor. */
twoFactor.post('/two-factor/verify',async c=>{
 const actor=await teammate(c),body=await c.req.json().catch(()=>({}))
 if(!actor.security?.hasFactor)throw new HTTPException(409,{message:'This account has no second factor to verify.'})
 const method=await proveFactor(c.env,actor.id,{code:body.code,recoveryCode:body.recoveryCode,credential:body.credential},c.req.url)
 await recordProof(c,actor,method,actor.security.factorAt===null||!SECOND_FACTORS.includes(actor.security.factorMethod!)?'two_factor.verified':'step_up.confirmed')
 return c.json({verified:true,method,...(method==='recovery'?{recoveryCodesRemaining:await remainingRecoveryCodes(c.env.DB,actor.id)}:{})})
})

/** A step-up for an account without a second factor re-enters the password; with one, the factor. */
twoFactor.post('/step-up',async c=>{
 const actor=await teammate(c),body=await c.req.json().catch(()=>({}))
 let method:FactorMethod
 if(actor.security?.hasFactor)method=await proveFactor(c.env,actor.id,{code:body.code,recoveryCode:body.recoveryCode,credential:body.credential},c.req.url)
 else{
  const credential=await c.env.DB.prepare('SELECT password_hash FROM credentials WHERE user_id=?').bind(actor.id).first<{password_hash:string}>()
  await provePassword(c,actor.id,body.password,credential?.password_hash??null,{refusedAction:'step_up.refused',message:'Password incorrect'})
  method='password'
 }
 await recordProof(c,actor,method,'step_up.confirmed')
 return c.json({steppedUp:true,method})
})

async function recordProof(c:Context<AppEnv>,actor:Actor,method:FactorMethod,action:string){
 await c.env.DB.batch([sessionFactorStatement(c.env.DB,c.get('sessionHash'),actor.id,method),...await accountAudit(c.env.DB,actor.id,{category:'auth',action,actor:{type:'user',id:actor.id},source:requestSource(c),detail:{method}})])
}
