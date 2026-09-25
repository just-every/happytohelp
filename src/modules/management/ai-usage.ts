import {Hono} from 'hono'
import type {AppEnv} from '../../platform/env'
import {scope} from './common'
import {automaticAiUsage} from '../ai-support/reply-ceiling'
import {contextRunUsage} from '../customer-context/run-ceiling'

/** Today's visitor-triggered AI usage against the installation's daily ceilings, for project members. */
export const aiUsage=new Hono<AppEnv>()
aiUsage.get('/projects/:projectId/ai-usage',async c=>{
 const actor=await scope(c)
 const [replies,contextRuns]=await Promise.all([automaticAiUsage(c.env,actor.projectId),contextRunUsage(c.env,actor.projectId)])
 return c.json({data:{...replies,contextRuns,contextRunCeilingReached:contextRuns.used>=contextRuns.limit}})
})
