export interface Job { type: string; id: string; projectId: string; [key: string]: unknown }
export interface Env { RER_INSTALLATION_ID?: string; H2H_SETUP_TOKEN?: string; H2H_SETUP_OWNER_EMAIL?: string; ASSETS?: Fetcher; RER_DEPLOY_SOURCE?: string; RER_DEPLOY_FINGERPRINT?: string; RER_VERSION?: { id: string }; DB: D1Database; FILES: R2Bucket; CONVERSATIONS: DurableObjectNamespace; JOBS: Queue<Job>; [key: string]: unknown }
export interface Actor { id: string; projectId: string; role: 'owner'|'admin'|'operator'|'contact'; contactId?: string }
export type AppEnv = { Bindings: Env; Variables: { actor: Actor; sessionHash: string } }
