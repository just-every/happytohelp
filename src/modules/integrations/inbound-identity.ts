import {hashToken} from '../../platform/auth'

/**
 * Message-IDs belong to a transport, while a HappyToHelp mailbox belongs to a
 * project. Keep the provider's ID in the response and use a deterministic
 * project-scoped key for durable claims and local admission.
 */
export async function scopedInboundId(projectId:string,messageId:string){
 return `email:${await hashToken(`${projectId}:${messageId}`)}`
}

export async function inboundLocalId(projectId:string,messageId:string){
 return `email:${await hashToken(`${projectId}:${messageId}`)}`
}

/** Local admission IDs written before project-scoping was introduced. Keep the
 * old form readable for existing first-project receipts while every new write
 * uses inboundLocalId above. */
export async function legacyInboundLocalId(messageId:string){
 return `email:${await hashToken(messageId)}`
}
