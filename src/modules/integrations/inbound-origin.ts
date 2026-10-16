import type {Env} from '../../platform/env'

/** Why an inbound email earned no reply, as the transcript and dashboard show it.
 * `verified:false` marks a From address no provider authenticated. */
export interface MessageOrigin {channel:'email';automatic:boolean;reasons:string[];verified?:false}
type ClaimRow={local_id:string;message_id:string|null;conversation_id:string|null;automatic:number;evidence_json:string|null}
type TranscriptMessage={id?:unknown;local_id?:unknown;conversation_id?:unknown;origin?:MessageOrigin}

// `email:` local ids are reserved for inbound claims (the message route refuses them).
const inboundLocalId=(message:TranscriptMessage)=>typeof message?.local_id==='string'&&message.local_id.startsWith('email:')?message.local_id:null
// The claim records the committed message once admission completes. Until then (a
// completion write lost after admission) the claim's local id and conversation,
// both written before admission, identify the message it owns.
const owns=(row:ClaimRow,message:TranscriptMessage)=>row.local_id===message.local_id&&(row.message_id!==null?row.message_id===String(message.id):row.conversation_id===String(message.conversation_id))
function stored(json:string|null){
 try{const parsed=JSON.parse(json||'null');return {reasons:Array.isArray(parsed?.reasons)?parsed.reasons.filter((reason:unknown):reason is string=>typeof reason==='string'):[],unverified:parsed?.sender_verified===false}}catch{return {reasons:[],unverified:false}}
}
const origin=(row:ClaimRow):MessageOrigin=>{const evidence=stored(row.evidence_json);return {channel:'email',automatic:row.automatic===1,reasons:evidence.reasons,...(evidence.unverified?{verified:false as const}:{})}}

async function claims(env:Env,projectId:string,localIds:string[]){
 const rows:ClaimRow[]=[]
 // D1 binds at most 100 parameters per statement.
 for(let index=0;index<localIds.length;index+=90){
  const chunk=localIds.slice(index,index+90)
  rows.push(...(await env.DB.prepare(`SELECT local_id,message_id,conversation_id,automatic,evidence_json FROM inbound_emails WHERE project_id=? AND local_id IN (${chunk.map(()=>'?').join(',')})`).bind(projectId,...chunk).all<ClaimRow>()).results)
 }
 return rows
}

export async function inboundOrigin(env:Env,projectId:string,message:TranscriptMessage):Promise<MessageOrigin|null>{
 const localId=inboundLocalId(message)
 if(!localId)return null
 const row=(await claims(env,projectId,[localId])).find(claim=>owns(claim,message))
 return row?origin(row):null
}

/** Message effects read this on first delivery and on every scheduled replay. */
export async function isAutomaticInboundEmail(env:Env,projectId:string,message:TranscriptMessage){
 return (await inboundOrigin(env,projectId,message))?.automatic===true
}

/** Attaches `origin` to the transcript messages an inbound email claim owns. */
export async function attachInboundOrigins<T extends TranscriptMessage>(env:Env,projectId:string,messages:T[]):Promise<T[]>{
 const localIds=[...new Set(messages.map(inboundLocalId).filter((value):value is string=>value!==null))]
 if(!localIds.length)return messages
 const rows=await claims(env,projectId,localIds)
 for(const message of messages){const row=rows.find(claim=>owns(claim,message));if(row)message.origin=origin(row)}
 return messages
}
