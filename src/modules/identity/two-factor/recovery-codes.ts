import {hashToken} from '../../../platform/auth'

const ALPHABET='abcdefghjkmnpqrstuvwxyz23456789'
const COUNT=10
const normalise=(code:string)=>code.toLowerCase().replace(/[^a-z0-9]/g,'')

function newCode(){
 const bytes=crypto.getRandomValues(new Uint8Array(10))
 const chars=Array.from(bytes,byte=>ALPHABET[byte%ALPHABET.length]).join('')
 return `${chars.slice(0,5)}-${chars.slice(5)}`
}

/** Ten fresh single-use codes replace any earlier set. The codes are returned once and stored only as hashes. */
export async function issueRecoveryCodes(db:D1Database,userId:string,now=Date.now()){
 const codes=Array.from({length:COUNT},newCode)
 const statements=[db.prepare('DELETE FROM recovery_codes WHERE user_id=?').bind(userId)]
 for(const code of codes)statements.push(db.prepare('INSERT INTO recovery_codes(user_id,code_hash,created_at) VALUES(?,?,?)').bind(userId,await hashToken(`recovery:${normalise(code)}`),now))
 return {codes,statements}
}

/** Spends one unused code atomically; a code already used, or never issued, is refused. */
export async function spendRecoveryCode(db:D1Database,userId:string,code:unknown,now=Date.now()){
 if(typeof code!=='string'||normalise(code).length!==10)return false
 const result=await db.prepare('UPDATE recovery_codes SET used_at=? WHERE user_id=? AND code_hash=? AND used_at IS NULL').bind(now,userId,await hashToken(`recovery:${normalise(code)}`)).run()
 return result.meta.changes===1
}

export async function remainingRecoveryCodes(db:D1Database,userId:string){
 return (await db.prepare('SELECT count(*) n FROM recovery_codes WHERE user_id=? AND used_at IS NULL').bind(userId).first<{n:number}>())?.n??0
}
