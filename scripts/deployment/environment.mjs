/** Runtime bindings selected by native modules. Values never appear in describe/plan output. */
export const secretNames = [
 'OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_API_KEY','GEMINI_API_KEY',
 'DEEPSEEK_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY','APIFY_TOKEN','QDRANT_API_KEY',
 'INTERCOM_TOKEN','FRESHDESK_TOKEN','ZENDESK_TOKEN','ZENDESK_EMAIL',
 'EMAIL_API_KEY','EMAIL_FROM','INBOUND_EMAIL_TOKEN',
 'INTEGRATION_ENCRYPTION_KEY','H2H_SETUP_TOKEN',
 'GITHUB_CLIENT_SECRET','GITHUB_TOKEN','GITHUB_TOKENS','TURNSTILE_SECRET',
]
export const variableNames = [
 'RER_INSTALLATION_ID','RER_MANAGEMENT_ORIGIN','H2H_SETUP_OWNER_EMAIL','REGISTRATION_ENABLED','LEAD_MODEL','CONTEXT_MODEL','KNOWLEDGE_EMBEDDING_MODEL','QDRANT_URL',
 'APIFY_CRAWLER_ACTOR_ID','GITHUB_CLIENT_ID','GITHUB_PROJECT_ID','PREVIEW_ORIGIN',
 'BRAND_IMAGE_MODEL','BRAND_IMAGE_SIZE',
 'BRAND_IMAGE_QUALITY','TRAINING_PRICE_CEILINGS','ENABLE_SYNTHETIC_EVALUATION',
]
const configured=(env,name)=>typeof env[name]==='string'&&env[name].trim()!==''
export function runtimeVariables(env){validateRuntimeEnvironment(env);return Object.fromEntries(variableNames.filter(name=>configured(env,name)).map(name=>[name,env[name]]))}
export function runtimeSecrets(env){return Object.fromEntries(secretNames.filter(name=>configured(env,name)).map(name=>[name,env[name]]))}
export function validateRuntimeEnvironment(env){
 for(const name of ['REGISTRATION_ENABLED','ENABLE_SYNTHETIC_EVALUATION'])if(configured(env,name)&&!['true','false'].includes(env[name]))throw new Error(`${name} must be true or false`)
 for(const name of ['APP_ORIGIN','PREVIEW_ORIGIN','RER_MANAGEMENT_ORIGIN','QDRANT_URL'])if(configured(env,name)){const url=new URL(env[name]);if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error(`${name} must be HTTPS without embedded credentials`);if(name!=='QDRANT_URL'&&(url.pathname!=='/'||url.search||url.port))throw new Error(`${name} must be an origin`)}
 if(configured(env,'PREVIEW_ORIGIN')&&(env.PREVIEW_ORIGIN===env.APP_ORIGIN||env.PREVIEW_ORIGIN===env.H2H_PUBLIC_ORIGIN))throw new Error('Preview must have a separate origin')
 if(configured(env,'TRAINING_PRICE_CEILINGS')){const values=JSON.parse(env.TRAINING_PRICE_CEILINGS);if(!values||Array.isArray(values)||typeof values!=='object')throw new Error('TRAINING_PRICE_CEILINGS must be a model map');for(const value of Object.values(values))if(!value||!Number.isFinite(value.inputPerMillion)||!Number.isFinite(value.outputPerMillion)||value.inputPerMillion<=0||value.outputPerMillion<=0)throw new Error('Training price ceilings require positive per-million input/output rates')}
 if(configured(env,'INTEGRATION_ENCRYPTION_KEY')&&Buffer.from(env.INTEGRATION_ENCRYPTION_KEY,'base64').length!==32)throw new Error('INTEGRATION_ENCRYPTION_KEY must encode 32 bytes')
 if(configured(env,'GITHUB_TOKENS')){const values=JSON.parse(env.GITHUB_TOKENS);if(!values||Array.isArray(values)||typeof values!=='object')throw new Error('GITHUB_TOKENS must be a private project/token map')}
}
