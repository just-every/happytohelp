import type {Env} from '../../platform/env'
import {aiCeilings} from '../../platform/limit-config'
import {consumeCounter,readCounter,refundCounter,type CounterWindow} from '../../platform/usage-counters'

export const contextRunWindow:CounterWindow={name:'ai:context-runs-per-project',seconds:86400}

/** Reserve one visitor-triggered monitoring run; null when today's ceiling is reached. */
export async function admitContextRun(env:Env,projectId:string){
 const reserved=await consumeCounter(env,contextRunWindow,projectId,aiCeilings(env).contextRunsPerProject)
 return reserved.allowed?{refund:()=>refundCounter(env,reserved)}:null
}

export async function contextRunUsage(env:Env,projectId:string){
 return {used:(await readCounter(env,contextRunWindow,projectId)).used,limit:aiCeilings(env).contextRunsPerProject}
}
