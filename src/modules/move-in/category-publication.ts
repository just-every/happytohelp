import type {D1Sql} from '../import-kit/src/d1/index'
export interface PublicationCategory {id:string;parent_id:string|null;name:string;slug:string;summary:string;is_published:number;position:number}
export function publicationCategory(value:any):PublicationCategory{const {id,parent_id,name,slug,summary,is_published,position}=value.tables.knowledge_categories[0];return {id,parent_id,name,slug,summary,is_published,position}}
/** An absent new category is expected before its creating batch. Once present,
 * every article batch must observe exactly the reviewed ancestry, atomically. */
export function categoryPublicationPredicates(project:string,categories:PublicationCategory[]):D1Sql[]{
 const result:D1Sql[]=[]
 for(let start=0;start<categories.length;start+=100){const fields=['parent_id','name','slug','summary','is_published','position'];result.push({sql:`NOT EXISTS(SELECT 1 FROM json_each(?) candidate JOIN knowledge_categories native ON native.id=json_extract(candidate.value,'$.id') WHERE native.project_id IS NOT ? OR ${fields.map(field=>`native.${field} IS NOT json_extract(candidate.value,'$.${field}')`).join(' OR ')})`,params:[JSON.stringify(categories.slice(start,start+100)),project]})}
 return result
}
