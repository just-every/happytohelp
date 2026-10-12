import type {Env,Job} from './platform/env'
import {boundedDatabase} from './platform/d1-budget'
import {consumeJob} from './jobs'
export async function consumeQueue(batch:MessageBatch<Job>,env:Env){const budget=boundedDatabase(env.DB);env={...env,DB:budget.database};for(const message of batch.messages){try{await consumeJob(message.body,env);message.ack()}catch{console.error('Persisted job handler failed',message.body.type,message.body.id);message.retry()}}return budget.metrics}
