import {HTTPException} from 'hono/http-exception'
/** The inbox search box matches a customer's name or email address, so nothing legitimate is longer than an email address. */
export const INBOX_SEARCH_MAX_LENGTH=200
export const INBOX_SEARCH_TOO_LONG=`That search is too long. Search by customer name or email address using at most ${INBOX_SEARCH_MAX_LENGTH} characters.`
/** Reads the `q` (or `search`) query parameter; an over-long term is a 400 with a message the inbox can show, never a database error. */
export function inboxSearchTerm(c:{req:{query:(name:string)=>string|undefined}}){
 const term=(c.req.query('q')||c.req.query('search')||'').trim()
 if(term.length>INBOX_SEARCH_MAX_LENGTH)throw new HTTPException(400,{message:INBOX_SEARCH_TOO_LONG})
 return term
}
/**
 * Literal, ASCII case-insensitive substring match on the contact's name or email. `instr` has no wildcard syntax, so `%`, `_` and `\`
 * match themselves, and it is not subject to the database's LIKE pattern-length limit.
 */
export function inboxSearchCondition(term:string){
 // SQLite lower() folds ASCII only, so fold the needle the same way or a non-ASCII letter would never equal itself.
 const needle=term.replace(/[A-Z]/g,letter=>letter.toLowerCase())
 return {sql:"EXISTS(SELECT 1 FROM contacts t WHERE t.id=c.contact_id AND (instr(lower(coalesce(t.name,'')),?)>0 OR instr(lower(coalesce(t.email,'')),?)>0))",params:[needle,needle]}
}
