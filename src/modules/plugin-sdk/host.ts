import {envelope,exactOrigin,validateCommand} from './protocol'
export interface PluginHostHandlers {
 setMessageContent(content:string):unknown|Promise<unknown>
 getConversation():unknown|Promise<unknown>
 resolveConversation(conversationId:string):unknown|Promise<unknown>
}
/** Bind one configured iframe. Handlers must perform native authorization themselves. */
export function connectPluginHost({iframe,pluginOrigin,handlers,window:scope=window}:{iframe:HTMLIFrameElement;pluginOrigin:string;handlers:PluginHostHandlers;window?:Window}) {
 const origin=exactOrigin(pluginOrigin)
 const send=(type:string,payload:unknown)=>iframe.contentWindow?.postMessage({happytohelp:true,type,payload},origin)
 const receive=async(event:MessageEvent)=>{
  if(event.origin!==origin||event.source!==iframe.contentWindow||!envelope(event.data)||!validateCommand(event.data.type,event.data.payload))return
  const {type,payload}=event.data
  try {
   switch(type){
    case 'setMessageContent':await handlers.setMessageContent(payload as string);break
    case 'getConversation':send('setConversation',await handlers.getConversation());break
    case 'resolveConversation':await handlers.resolveConversation(payload as string);send('resolveConversation',{id:payload});break
    case 'setHeight':iframe.style.height=`${Number.parseInt(String(payload),10)}px`;break
   }
  }catch(error){send('error',{command:type,message:error instanceof Error?error.message:'Plugin command failed'})}
 }
 scope.addEventListener('message',receive)
 return {send,destroy:()=>scope.removeEventListener('message',receive)}
}
