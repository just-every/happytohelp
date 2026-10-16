import type {Env} from '../../platform/env'
import {contactWritable} from '../../platform/contact-state'
import {retainedContactMetadata} from './contact-environment'

// Signed business metadata is replaced. Collected context, including explicit
// null identity aliases, and operator-owned lifecycle fields remain intact.
export async function updateSignedWidgetMetadata(env:Env,projectId:string,contactId:string,metadata:Record<string,unknown>){
 const current=await env.DB.prepare('SELECT metadata_json FROM contacts WHERE id=? AND project_id=?').bind(contactId,projectId).first<{metadata_json:string}>()
 const stored=JSON.parse(current?.metadata_json||'{}') as Record<string,unknown>
 const businessMetadata=Object.fromEntries(Object.entries(metadata).filter(([key])=>!retainedContactMetadata.includes(key)))
 for(const key of retainedContactMetadata)if(Object.hasOwn(stored,key))businessMetadata[key]=stored[key]
 return env.DB.prepare(`UPDATE contacts SET metadata_json=?
  WHERE id=? AND project_id=? AND metadata_json IS ? AND ${contactWritable}
  AND coalesce(json_extract(metadata_json,'$.is_blocked'),0)!=1
  AND coalesce(json_extract(metadata_json,'$.is_deleted'),0)!=1`)
  .bind(JSON.stringify(businessMetadata),contactId,projectId,current?.metadata_json??null).run()
}
