import {decodeCbor} from './cbor'

/** WebAuthn security keys and passkeys (W3C Web Authentication Level 2), attestation "none", ES256 or RS256. */
export const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
export function fromB64url(text:unknown){
 if(typeof text!=='string'||!/^[A-Za-z0-9_-]*$/.test(text)||text.length>16384)throw new WebAuthnError('malformed')
 const padded=text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)
 return Uint8Array.from(atob(padded),char=>char.charCodeAt(0))
}
export class WebAuthnError extends Error {}
const sha256=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))
const equal=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((value,i)=>value===b[i])

/** The relying party is the installation's own origin: its hostname is the rpId. */
export function relyingParty(origin:string){const url=new URL(origin);return {id:url.hostname,origin:url.origin}}

interface ClientData {type:string;challenge:string;origin:string}
function clientData(json:Uint8Array,type:string,challenge:string,origin:string){
 let data:ClientData
 try{data=JSON.parse(new TextDecoder().decode(json))}catch{throw new WebAuthnError('client_data')}
 if(data.type!==type)throw new WebAuthnError('client_data_type')
 if(data.challenge!==challenge)throw new WebAuthnError('challenge')
 if(data.origin!==origin)throw new WebAuthnError('origin')
}

interface AuthenticatorData {rpIdHash:Uint8Array;flags:number;signCount:number;credentialId?:Uint8Array;publicKey?:Map<number,unknown>}
function authenticatorData(bytes:Uint8Array):AuthenticatorData{
 if(bytes.length<37)throw new WebAuthnError('authenticator_data')
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),flags=bytes[32]
 const result:AuthenticatorData={rpIdHash:bytes.slice(0,32),flags,signCount:view.getUint32(33)}
 if(flags&0x40){
  if(bytes.length<55)throw new WebAuthnError('authenticator_data')
  const length=view.getUint16(53)
  result.credentialId=bytes.slice(55,55+length)
  const key=decodeCbor(bytes.subarray(55+length)).value
  if(!(key instanceof Map))throw new WebAuthnError('public_key')
  result.publicKey=key as Map<number,unknown>
 }
 return result
}

/** A COSE public key as a JWK WebCrypto can import: EC2 P-256 (ES256) or RSA (RS256). */
function coseToJwk(key:Map<number,unknown>){
 const kty=key.get(1),alg=key.get(3)
 if(kty===2&&alg===-7&&key.get(-1)===1){const x=key.get(-2),y=key.get(-3);if(!(x instanceof Uint8Array)||!(y instanceof Uint8Array))throw new WebAuthnError('public_key');return {alg:-7,jwk:{kty:'EC',crv:'P-256',x:b64url(x),y:b64url(y)}}}
 if(kty===3&&alg===-257){const n=key.get(-1),e=key.get(-2);if(!(n instanceof Uint8Array)||!(e instanceof Uint8Array))throw new WebAuthnError('public_key');return {alg:-257,jwk:{kty:'RSA',n:b64url(n),e:b64url(e),alg:'RS256'}}}
 throw new WebAuthnError('algorithm')
}

async function checkRelyingParty(data:AuthenticatorData,rpId:string){
 if(!equal(data.rpIdHash,await sha256(new TextEncoder().encode(rpId))))throw new WebAuthnError('rp_id')
 if(!(data.flags&0x01))throw new WebAuthnError('user_presence')
}

export interface RegistrationInput {id:string;response:{clientDataJSON:string;attestationObject:string}}
export async function verifyRegistration(input:RegistrationInput,expected:{challenge:string;origin:string;rpId:string}){
 clientData(fromB64url(input?.response?.clientDataJSON),'webauthn.create',expected.challenge,expected.origin)
 const attestation=decodeCbor(fromB64url(input.response.attestationObject)).value
 if(!(attestation instanceof Map))throw new WebAuthnError('attestation')
 const raw=attestation.get('authData')
 if(!(raw instanceof Uint8Array))throw new WebAuthnError('attestation')
 const data=authenticatorData(raw)
 await checkRelyingParty(data,expected.rpId)
 if(!data.credentialId||!data.publicKey)throw new WebAuthnError('credential')
 if(b64url(data.credentialId)!==input.id)throw new WebAuthnError('credential_id')
 const {alg,jwk}=coseToJwk(data.publicKey)
 return {credentialId:input.id,publicKey:JSON.stringify(jwk),algorithm:alg,signCount:data.signCount}
}

/** DER ECDSA signatures become the raw r||s pairs WebCrypto verifies. */
function derToRaw(der:Uint8Array){
 if(der[0]!==0x30)throw new WebAuthnError('signature')
 let offset=2
 const part=()=>{if(der[offset]!==0x02)throw new WebAuthnError('signature');const length=der[offset+1];let value=der.slice(offset+2,offset+2+length);offset+=2+length;while(value.length>32&&value[0]===0)value=value.slice(1);if(value.length>32)throw new WebAuthnError('signature');const out=new Uint8Array(32);out.set(value,32-value.length);return out}
 const r=part(),s=part(),raw=new Uint8Array(64);raw.set(r);raw.set(s,32);return raw
}

export interface AssertionInput {id:string;response:{clientDataJSON:string;authenticatorData:string;signature:string}}
export async function verifyAssertion(input:AssertionInput,stored:{publicKey:string;algorithm:number;signCount:number},expected:{challenge:string;origin:string;rpId:string}){
 const json=fromB64url(input?.response?.clientDataJSON)
 clientData(json,'webauthn.get',expected.challenge,expected.origin)
 const raw=fromB64url(input.response.authenticatorData),data=authenticatorData(raw)
 await checkRelyingParty(data,expected.rpId)
 const signed=new Uint8Array(raw.length+32);signed.set(raw);signed.set(await sha256(json),raw.length)
 const signature=fromB64url(input.response.signature),jwk=JSON.parse(stored.publicKey)
 const valid=stored.algorithm===-7
  ?await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']),derToRaw(signature),signed)
  :await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']),signature,signed)
 if(!valid)throw new WebAuthnError('signature')
 // A counter that stops increasing means a cloned authenticator; authenticators that never count stay at zero.
 if((data.signCount!==0||stored.signCount!==0)&&data.signCount<=stored.signCount)throw new WebAuthnError('sign_count')
 return {signCount:data.signCount}
}
