/** Customers see the public request state, never an internal status or team label. */
export function customerTicket(row:any){
 if(!row)return row
 const {status_id,status_category,ticket_actor_id,ticket_actor_type,ticket_source,ticket_version,group_id,submitter_id,submitter_type,...publicRow}=row
 const status=['solved','closed'].includes(status_category)?'solved':'open'
 return {...publicRow,status_id:status,status_category:status,status}
}
