import {HTTPException} from 'hono/http-exception'
export const INBOX_SEARCH_MAX_LENGTH=200
export const INBOX_SEARCH_TOO_LONG=`That search is too long. Search for a message phrase, customer name or email using at most ${INBOX_SEARCH_MAX_LENGTH} characters.`
/** Bound input before it reaches either the identity or full-text search. */
export function inboxSearchTerm(c:{req:{query:(name:string)=>string|undefined}}){
 const term=(c.req.query('q')||c.req.query('search')||'').trim()
 if(term.length>INBOX_SEARCH_MAX_LENGTH)throw new HTTPException(400,{message:INBOX_SEARCH_TOO_LONG})
 return term
}
/** Identity substrings are literal; message words use an indexed, quoted phrase.
 * Quoting prevents operators such as OR, * or column names becoming FTS syntax.
 * Membership/project conditions on the outer conversation query remain authoritative.
 */
export function inboxSearchCondition(term:string){
 const needle=term.replace(/[A-Z]/g,letter=>letter.toLowerCase())
 const fields=["t.name","t.email","json_extract(t.metadata_json,'$.provided_name')","json_extract(t.metadata_json,'$.provided_email')"]
 const identity=`EXISTS(SELECT 1 FROM contacts t WHERE t.id=c.contact_id AND t.project_id=c.project_id AND (${fields.map(field=>`instr(lower(coalesce(${field},'')),?)>0`).join(' OR ')}))`
 // A punctuation-only query has no words to index; it can still match identity.
 if(!/[\p{L}\p{N}]/u.test(term)||term.includes('\0'))return {sql:identity,params:fields.map(()=>needle)}
 const phrase='"'+term.replace(/"/g,'""')+'"'
 return {sql:`(${identity} OR c.id IN (SELECT conversation_id FROM inbox_message_search WHERE inbox_message_search MATCH ?))`,params:[...fields.map(()=>needle),phrase]}
}
