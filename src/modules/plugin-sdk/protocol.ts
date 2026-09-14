export type PluginCommand = 'setMessageContent' | 'getConversation' | 'resolveConversation' | 'setHeight'
export interface PluginEnvelope {happytohelp:true;type:string;payload?:unknown}
export function exactOrigin(value:string):string {
 const url=new URL(value)
 if(url.origin!==value || !['https:','http:'].includes(url.protocol))throw new Error('Configure an exact HTTP(S) origin without path or wildcard')
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Plugin origins require HTTPS outside localhost')
 return url.origin
}
export function envelope(value:unknown):value is PluginEnvelope {return !!value&&typeof value==='object'&&(value as PluginEnvelope).happytohelp===true&&typeof (value as PluginEnvelope).type==='string'}
export function validateCommand(type:string,payload:unknown):type is PluginCommand {
 switch(type){
  case 'getConversation':return payload===undefined||payload===null
  case 'setMessageContent':return typeof payload==='string'&&payload.length<=100000
  case 'resolveConversation':return typeof payload==='string'&&payload.length>0&&payload.length<=200
  case 'setHeight':return typeof payload==='number'?Number.isFinite(payload)&&payload>=0&&payload<=4000:typeof payload==='string'&&/^\d{1,4}px$/.test(payload)&&Number.parseInt(payload)<=4000
  default:return false
 }
}
