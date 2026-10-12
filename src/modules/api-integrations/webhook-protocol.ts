import {createWebhookProtocol,retryAfter} from '../../vendor/base/modules/integrations/index.ts'

/** HappyToHelp retries explicit server failures; Base still owns signing and bounded attempts. */
export function webhookProtocol(options:Parameters<typeof createWebhookProtocol>[0]){
 const protocol=createWebhookProtocol(options)
 return {...protocol,classify(response:Parameters<typeof protocol.classify>[0],now:number){
  if(response.status>=500&&response.status<600)return {kind:'retryable' as const,code:'webhook_server_error',status:response.status,retryAfterMs:retryAfter(response,now)}
  return protocol.classify(response,now)
 }}
}
