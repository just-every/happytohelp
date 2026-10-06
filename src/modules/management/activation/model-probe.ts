import type {Configuration} from './configuration'
import type {Probe} from './types'
import {providerJson,bearer} from './provider-http'

/** Non-generative metadata APIs. These calls do not ask a model to generate tokens.
 * https://platform.openai.com/docs/api-reference/models/retrieve
 * https://platform.claude.com/docs/en/api/models/retrieve
 * https://ai.google.dev/api/models
 * https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key
 */
export async function checkModel(config:Configuration):Promise<Probe> {
 const {assistant,model,provider,secretName,key}=config
 if(!assistant?.is_enabled)return {state:'pending',detail:'Choose an enabled default visitor assistant in AI settings.'}
 if(!secretName)return {state:'unavailable',detail:'The selected model provider is not supported by this installation.'}
 if(typeof key!=='string'||!key.trim())return {state:'unavailable',detail:`CONFIGURATION_REQUIRED: ${secretName}. Add this secret to the installation, then check again.`}
 let body:any
 const encoded=encodeURIComponent(model)
 if(provider==='openai')body=await providerJson(`https://api.openai.com/v1/models/${encoded}`,bearer(key))
 else if(provider==='anthropic')body=await providerJson(`https://api.anthropic.com/v1/models/${encoded}`,{'x-api-key':key,'anthropic-version':'2023-06-01'})
 else if(provider==='google')body=await providerJson(`https://generativelanguage.googleapis.com/v1beta/models/${encoded}`,{'x-goog-api-key':key})
 else if(provider==='openrouter') {
  body=await providerJson('https://openrouter.ai/api/v1/key',bearer(key))
  if(!body.data||typeof body.data.label!=='string')return {state:'unknown',detail:'The provider did not return an authenticated key record.'}
  return {state:'done',detail:`${provider} authenticated ${secretName}. Model selection: ${model}. Generation and model availability still require a real reply.`,receiptRef:`provider:${provider}:key-metadata`}
 } else return {state:'unavailable',detail:`${provider} is selected and ${secretName} is installed. This provider has no supported non-generative validation here; key presence is not validation.`}
 if(provider==='google'?body.name!==`models/${model}`:body.id!==model)return {state:'unknown',detail:'The provider did not return a model identity.'}
 return {state:'done',detail:`${provider} authenticated ${secretName} and returned model metadata for ${model}. This does not generate an answer.`,receiptRef:`provider:${provider}:model:${body.id||body.name}`}
}
