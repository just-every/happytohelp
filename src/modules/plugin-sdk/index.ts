import {envelope,exactOrigin,validateCommand} from './protocol'
/** Embeddable SDK; preserves the HappytoHelp event envelope without baked hosts. */
export function createPluginClient({hostOrigin,window:scope=window}:{hostOrigin:string;window?:Window}) {
 const origin=exactOrigin(hostOrigin),listeners=new Map<string,Set<(payload:unknown)=>void>>()
 const receive=(event:MessageEvent)=>{if(event.origin!==origin||event.source!==scope.parent||!envelope(event.data))return;for(const listener of listeners.get(event.data.type)||[])listener(event.data.payload)}
 scope.addEventListener('message',receive)
 const sendEvent=(type:string,payload?:unknown)=>{if(!validateCommand(type,payload))throw new Error('Invalid plugin command');scope.parent.postMessage({happytohelp:true,type,payload},origin)}
 return {
  on(type:string,listener:(payload:unknown)=>void){const group=listeners.get(type)||new Set();group.add(listener);listeners.set(type,group);return()=>group.delete(listener)},
  sendEvent,
  setMessageContent:(content:string)=>sendEvent('setMessageContent',content),
  getConversation:()=>sendEvent('getConversation'),
  resolveConversation:(conversationId:string)=>sendEvent('resolveConversation',conversationId),
  setHeight:(height:number|string)=>sendEvent('setHeight',height),
  destroy(){scope.removeEventListener('message',receive);listeners.clear()},
 }
}
