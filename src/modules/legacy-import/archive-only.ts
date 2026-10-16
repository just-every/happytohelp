import type {Row, LegacyBundle} from './types'
// Retain deleted legacy records without making their content visible again.
export function archiveOnly(table:string,row:Row,bundle:LegacyBundle):boolean {
 const find=(table:string,id:unknown)=>(bundle.tables[table]||[]).find(r=>String(r.id)===String(id))
 if(row.deleted_at)return true
 const project=table==='projects'?row:find('projects',row.project_id)
 if(project?.deleted_at)return true
 const conversation=table==='conversations'?row:find('conversations',row.conversation_id)
 if(conversation?.deleted_at||find('projects',conversation?.project_id)?.deleted_at||find('contacts',conversation?.contact_id)?.deleted_at)return true
 if(table==='project_users'&&find('users',row.user_id)?.deleted_at)return true
 if(table==='conversation_participants'&&find('contacts',row.contact_id)?.deleted_at)return true
 if(table==='media'){
  const join=(bundle.tables.mediables||[]).find(r=>String(r.media_id)===String(row.id)&&String(r.mediable_type).endsWith('Message'))
  const message=find('messages',row.message_id||join?.mediable_id)
  if(message&&(message.deleted_at||archiveOnly('messages',message,bundle)))return true
 }
 return false
}
