export interface Job { type: string; id: string; projectId: string; [key: string]: unknown }
export interface Env { DB: D1Database; FILES: R2Bucket; CONVERSATIONS: DurableObjectNamespace; JOBS: Queue<Job>; [key: string]: unknown }
export interface Actor { id: string; projectId: string; role: 'owner'|'admin'|'operator'|'contact'; contactId?: string }
export type AppEnv = { Bindings: Env; Variables: { actor: Actor } }
