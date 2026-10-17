/** RFC 6238 time-based one-time passwords: SHA-1, six digits, 30-second steps, as every authenticator app reads them. */
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const STEP_SECONDS=30

export function base32(bytes:Uint8Array){
 let bits=0,value=0,out=''
 for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5}}
 if(bits>0)out+=ALPHABET[(value<<(5-bits))&31]
 return out
}
export function fromBase32(text:string){
 const clean=text.toUpperCase().replace(/[\s=-]/g,''),out:number[]=[]
 let bits=0,value=0
 for(const char of clean){const index=ALPHABET.indexOf(char);if(index<0)throw new Error('invalid_base32');value=(value<<5)|index;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}
 return Uint8Array.from(out)
}
export const newTotpSecret=()=>base32(crypto.getRandomValues(new Uint8Array(20)))

export async function totpCode(secret:string,step:number){
 const key=await crypto.subtle.importKey('raw',fromBase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign'])
 const counter=new Uint8Array(8);let rest=step
 for(let i=7;i>=0;i--){counter[i]=rest%256;rest=Math.floor(rest/256)}
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter)),offset=mac[19]&15
 const binary=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3]
 return String(binary%1_000_000).padStart(6,'0')
}

/** The step a code belongs to, allowing one step of clock drift either way. Steps at or before `usedStep` are spent. */
export async function matchingStep(secret:string,code:unknown,usedStep:number|null,now=Date.now()){
 if(typeof code!=='string'||!/^\d{6}$/.test(code.replace(/\s/g,'')))return null
 const wanted=code.replace(/\s/g,''),current=Math.floor(now/1000/STEP_SECONDS)
 for(const step of [current-1,current,current+1]){
  if(usedStep!==null&&step<=usedStep)continue
  if(await totpCode(secret,step)===wanted)return step
 }
 return null
}

export function otpauthUri(secret:string,account:string){
 const label=`HappyToHelp:${encodeURIComponent(account)}`
 return `otpauth://totp/${label}?secret=${secret}&issuer=HappyToHelp&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`
}
