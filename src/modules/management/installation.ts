import type {Env} from '../../platform/env'
import {localMailOrigin} from '../../edition/local-mail/configuration'

export type Installation={environment:'local'|'hosted';origin:string;worker:string|null}
/** What setup pages need to give exact steps: local or hosted, this app's address and,
 * on a workers.dev address, the Worker's name. Never a secret or a configured value. */
export function installation(env:Env,requestUrl:string):Installation{
 let origin=new URL(requestUrl).origin
 try{if(typeof env.APP_ORIGIN==='string'&&env.APP_ORIGIN)origin=new URL(env.APP_ORIGIN).origin}catch{}
 const host=new URL(origin).hostname
 return {environment:localMailOrigin(env)?'local':'hosted',origin,worker:host.endsWith('.workers.dev')?host.split('.')[0]:null}
}
