import type {Env} from '../../platform/env'
import {sha256} from '../import-kit/src/d1/index'
import type {Run} from './types'
/** A review's decisions and diagnostics grow with the export, past D1's 2 MB row limit
 * for 5,000 records. The run row keeps the summary (fingerprint, counts and this report's
 * key and hash); the report is private custody under the run's prefix, so erasure removes it.
 * Reviews prepared before 0.4.1 keep their report inline and are returned unchanged. */
export interface ReportRef {key:string;sha256:string}
export function planSummary(planJson:string|null){if(!planJson)return null;const {report:_,...summary}=JSON.parse(planJson);return summary}
export async function reviewPlan(env:Env,run:Pick<Run,'plan_json'>){
 const plan=planSummary(run.plan_json),ref:ReportRef|undefined=run.plan_json?JSON.parse(run.plan_json).report:undefined
 if(!plan||!ref)return plan
 const object=await env.FILES.get(ref.key);if(!object)throw new Error('review_report_missing')
 const text=await object.text();if(sha256(text)!==ref.sha256)throw new Error('review_report_changed')
 return {...plan,...JSON.parse(text)}
}
