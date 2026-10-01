import { HTTPException } from 'hono/http-exception'
export const id=()=>crypto.randomUUID()
/** 256-bit server secret as lowercase hex, used for HMAC signing keys such as the widget's signed-in-user verification. */
export const serverSecret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')
export function requiredString(value: unknown,name:string,max=10000):string {if(typeof value!=='string'||!value.trim()||value.length>max)throw new HTTPException(400,{message:`Invalid ${name}`});return value}
