import { HTTPException } from 'hono/http-exception'
export const id=()=>crypto.randomUUID()
export function requiredString(value: unknown,name:string,max=10000):string {if(typeof value!=='string'||!value.trim()||value.length>max)throw new HTTPException(400,{message:`Invalid ${name}`});return value}
