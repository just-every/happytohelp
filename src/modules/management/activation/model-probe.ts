import type {Configuration} from './configuration'
import type {Probe} from './types'
import {providerJson,bearer} from './provider-http'
// @ts-ignore Use the same model identity mapping as the generation adapter.
import {findModel} from '../../ai-support/vendor/ensemble/data/model_data.js'

/** Providers whose key can be checked here with a non-generative metadata request. Any other provider's key is installed but unconfirmable. */
export const metadataProviders:ReadonlySet<string>=new Set(['openai','anthropic','google','openrouter'])

/** Non-generative metadata APIs. These calls do not ask a model to generate tokens.
 * https://platform.openai.com/docs/api-reference/models/retrieve
 * https://platform.claude.com/docs/en/api/models/retrieve
 * https://ai.google.dev/api/models
 * https://openrouter.ai/docs/api/api-reference/models/list-models-filtered-by-user-provider-preferences-privacy-settings-and-guardrails
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
  const selected=findModel(model)?.openrouter_id||model
  const models=await providerJson('https://openrouter.ai/api/v1/models/user',bearer(key))
  if(!Array.isArray(models.data))return {state:'unknown',detail:'The provider did not return its available model list.'}
  if(!models.data.some((row:any)=>row?.id===selected))return {state:'failed',detail:`The selected model ${selected} is not available under this OpenRouter account. Choose an available model in AI settings, then check again.`}
  return {state:'done',detail:`${provider} authenticated ${secretName} and returned available model metadata for ${selected}. A real reply still needs its own proof.`,receiptRef:`provider:${provider}:model:${selected}`}
 } else return {state:'unavailable',detail:`${provider} is selected and ${secretName} is installed. This provider has no supported non-generative validation here; key presence is not validation.`}
 if(provider==='google'?body.name!==`models/${model}`:body.id!==model)return {state:'unknown',detail:'The provider did not return a model identity.'}
 return {state:'done',detail:`${provider} authenticated ${secretName} and returned model metadata for ${model}. This does not generate an answer.`,receiptRef:`provider:${provider}:model:${body.id||body.name}`}
}
