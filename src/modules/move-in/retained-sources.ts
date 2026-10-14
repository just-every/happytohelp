import {canonicalJson,type D1Sql,type SourceRecord,type TargetRow} from '../import-kit/src/d1/index'
import {sourceIdentity} from '../import-kit/src/provenance/identity'
import {publicationCategory} from './category-publication'
import {MAPPING_VERSION,recordKey,type PreparedMapping,type Run,type SourceClaim} from './types'
/** Native edits belong to the workspace. Keep the existing source claim out of
 * new kit jobs rather than replacing its effects hash with an empty rejection.
 * The reviewed claim is fenced in every publishing transaction. */
export function retainNativeConflicts(run:Run,records:SourceRecord[],prepared:PreparedMapping,claims:Map<string,SourceClaim>,native:Map<string,TargetRow>){
 const usableAncestry=new Set<string>()
 prepared.retained??=new Map();prepared.retainedCategories??=[]
 for(const record of records){
  const key=recordKey(record),reason=prepared.rejections.get(key),claim=claims.get(sourceIdentity(run.project_id,run.vendor,record.kind,record.sourceId))
  if(!claim||claim.source_hash!==record.payloadHash||claim.mapping_version!==MAPPING_VERSION||!['native_target_conflict','article_ancestry_incomplete_or_conflicting'].includes(reason??''))continue
  prepared.retained.set(key,claim)
  if(!['collection','category'].includes(record.kind)||reason!=='native_target_conflict')continue
  for(const effect of prepared.effects.get(key)??[]){
   if(effect.targetKind!=='category')continue
   const existing=native.get(`category/${effect.targetId}`);if(!existing)continue
   const current=publicationCategory(existing.value),wanted=publicationCategory(effect.value)
   if(!prepared.retainedCategories.some(category=>category.id===current.id))prepared.retainedCategories.push(current)
   // A renamed ancestor can host new articles. Changed hierarchy or visibility
   // remains a conflict; source publication must never override native privacy.
   if(canonicalJson([current.parent_id,current.is_published])===canonicalJson([wanted.parent_id,wanted.is_published]))usableAncestry.add(key)
  }
 }
 return usableAncestry
}
export function retainedSourcePredicates(project:string,vendor:string,claims:SourceClaim[]):D1Sql[]{
 const predicates:D1Sql[]=[]
 for(let start=0;start<claims.length;start+=100)predicates.push({sql:`NOT EXISTS(SELECT 1 FROM json_each(?) candidate WHERE NOT EXISTS(SELECT 1 FROM ik_sources s JOIN ik_jobs j ON j.id=s.job_id WHERE j.destination=? AND j.namespace=? AND ${['identity','source_hash','mapping_version','effects_hash','job_id'].map(field=>`s.${field}=json_extract(candidate.value,'$.${field}')`).join(' AND ')}))`,params:[JSON.stringify(claims.slice(start,start+100)),project,vendor]})
 return predicates
}
