import type {Env} from '../../platform/env'
// @ts-ignore Selected provider registry source.
import {getProviderFromModel} from './vendor/ensemble/model_providers/model_provider.js'
export class AiConfigurationError extends Error {
 readonly status=503
 readonly code='CONFIGURATION_REQUIRED'
 constructor(requirement:string){super(`CONFIGURATION_REQUIRED: ${requirement}`)}
}
export function assertModelConfigured(env:Env,model:string){
 const provider=getProviderFromModel(model),keys:Record<string,string>={openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',google:'GOOGLE_API_KEY',deepseek:'DEEPSEEK_API_KEY',xai:'XAI_API_KEY',openrouter:'OPENROUTER_API_KEY'}
 if(!keys[provider])throw Object.assign(new Error(`PROVIDER_NOT_SELECTED: ${provider}`),{status:503})
 if(!env[keys[provider]]&&!(provider==='google'&&env.GEMINI_API_KEY))throw new AiConfigurationError(keys[provider])
}
