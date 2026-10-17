export {inboundEmail} from './inbound'
export {handleEmail} from './email-worker'
export {notifyMailboxMessage as notifyMessage} from './mailbox-notifications'
export {attachInboundOrigins,isAutomaticInboundEmail} from './inbound-origin'
export {handleLeadJob} from './leads'
import {recoverLeadJobs as recoverLeads} from './leads'
import {maintainEmail} from './email-maintenance'
import type {Env} from '../../platform/env'
export async function recoverLeadJobs(env:Env){await maintainEmail(env);return recoverLeads(env)}
