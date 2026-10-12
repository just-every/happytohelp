import type {Env} from '../../platform/env'
import {contactWritable} from '../../platform/contact-state'

// Signed business metadata is replaced, but collected identity aliases belong
// to the contact. Preserve even explicit nulls without copying unrelated fields.
const retainedCollectorMetadata=['provided_name','provided_email'].reduce((value,key)=>
 `CASE WHEN json_type(metadata_json,'$.${key}') IS NOT NULL
  THEN json_set(${value},'$.${key}',json_extract(metadata_json,'$.${key}')) ELSE ${value} END`,'?1')

export function updateSignedWidgetMetadata(env:Env,projectId:string,contactId:string,metadata:Record<string,unknown>){
 return env.DB.prepare(`UPDATE contacts SET metadata_json=${retainedCollectorMetadata}
  WHERE id=?2 AND project_id=?3 AND ${contactWritable}
  AND coalesce(json_extract(metadata_json,'$.is_blocked'),0)!=1
  AND coalesce(json_extract(metadata_json,'$.is_deleted'),0)!=1`)
  .bind(JSON.stringify(metadata),contactId,projectId).run()
}
