import type {Env} from '../../src/platform/env'
import {publicationPredicates,publicationDatabase,type PublicationContact} from '../../src/modules/move-in/publication'
import {boundedDatabase} from '../../src/platform/d1-budget'
import {reviewFingerprint} from '../../src/modules/move-in/plans'
export async function publicationBoundary(env:Env,contacts:PublicationContact[]){
 const budget=boundedDatabase(env.DB),predicates=publicationPredicates('p',contacts)
 for(const predicate of predicates){const row=await budget.database.prepare(`SELECT (${predicate.sql}) allowed`).bind(...predicate.params!).first<{allowed:number}>();if(!row?.allowed)throw new Error('unexpected fixture collision')}
 await publicationDatabase(budget.database,predicates).batch([budget.database.prepare("INSERT INTO workspace_tags(id,project_id,name,normalized_name) VALUES('boundary','p','Boundary','boundary')")])
 return {predicates:predicates.length,...budget.metrics}
}
export async function legacyReview(env:Env,id:string){
 const run=await env.DB.prepare('SELECT * FROM move_in_runs WHERE id=?').bind(id).first<any>(),old=await env.FILES.get(`move-in/p/${id}/review/${run.review_fingerprint}`),review=await old!.json<any>()
 delete review.contacts;review.fingerprint=reviewFingerprint(review)
 await env.FILES.put(`move-in/p/${id}/review/${review.fingerprint}`,JSON.stringify(review))
 const plan=JSON.parse(run.plan_json);plan.fingerprint=review.fingerprint
 await env.DB.prepare('UPDATE move_in_runs SET review_fingerprint=?,plan_json=? WHERE id=?').bind(review.fingerprint,JSON.stringify(plan),id).run()
 return {legacy:true}
}
