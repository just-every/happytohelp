import type {Env} from '../../../platform/env'
import {hashToken} from '../../../platform/auth'
import {emailAddress} from '../../integrations/inbound-routing'
import {selectedEmailProvider} from '../../integrations/email-provider'
// @ts-ignore The installed runtime uses this same provider registry.
import {getProviderFromModel} from '../../ai-support/vendor/ensemble/model_providers/model_provider.js'
import type {StepId} from './types'

export const modelSecrets:Record<string,string> = {openai:'OPENAI_API_KEY',anthropic:'ANTHROPIC_API_KEY',google:'GOOGLE_API_KEY',deepseek:'DEEPSEEK_API_KEY',xai:'XAI_API_KEY',openrouter:'OPENROUTER_API_KEY'}
export async function activationConfiguration(env:Env, projectId:string) {
 const [project,email,owners,article] = await Promise.all([
  env.DB.prepare('SELECT p.allowed_origin,s.settings_json FROM projects p LEFT JOIN project_settings s ON s.project_id=p.id WHERE p.id=?').bind(projectId).first<any>(),
  env.DB.prepare('SELECT * FROM email_settings WHERE project_id=?').bind(projectId).first<any>(),
  env.DB.prepare("SELECT u.id,u.email FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.project_id=? AND m.role='owner' ORDER BY u.id").bind(projectId).all<{id:string;email:string}>(),
  env.DB.prepare("SELECT id,title,slug,updated_at FROM knowledge_articles WHERE project_id=? AND status='published' ORDER BY updated_at,id LIMIT 1").bind(projectId).first<any>(),
 ])
 const settings=JSON.parse(project?.settings_json||'{}')
 const assistantId=settings.default_visitor_ai_id || settings.default_responder
 const assistant=assistantId?await env.DB.prepare('SELECT id,model,is_enabled FROM ai_profiles WHERE project_id=? AND id=?').bind(projectId,assistantId).first<any>():null
 const model=typeof assistant?.model==='string'?assistant.model:''
 const provider=model?String(getProviderFromModel(model)):null
 const secretName=provider?modelSecrets[provider]:null
 const key=secretName?env[secretName]||(provider==='google'?env.GEMINI_API_KEY:undefined):undefined
 const sender=emailAddress(email?.from_address||env.EMAIL_FROM)
 const providerName=selectedEmailProvider(env)
 // Digests stay server-side. Never return credential material or its digest to the browser.
 const mailIdentity=[providerName,sender,email?.from_name||'',env.EMAIL_FROM,env.EMAIL_ACCOUNT_ID,env.EMAIL_API_KEY]
 const values:Record<StepId,unknown>={
  owner_mail:[mailIdentity,owners.results],sender_dns:mailIdentity,
  inbound_address:[email?.inbound_address,email?.is_enabled,email?.updated_at,env.INBOUND_EMAIL_TOKEN],
  model_key:[assistantId,model,assistant?.is_enabled,provider,key],spend_ceilings:env.AI_DAILY_CEILINGS||null,
  published_article:article||null,widget_origin:project?.allowed_origin,widget_seen:[project?.allowed_origin,env.PREVIEW_ORIGIN],
 }
 const fingerprints=Object.fromEntries(await Promise.all(Object.entries(values).map(async([id,value])=>[id,await hashToken(JSON.stringify(value)??'null')])) ) as Record<StepId,string>
 return {projectId,project,email,owners:owners.results,article,assistant,model,provider,secretName,key,sender,providerName,fingerprints}
}
export type Configuration=Awaited<ReturnType<typeof activationConfiguration>>
