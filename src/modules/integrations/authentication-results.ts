/**
 * RFC 8601 Authentication-Results, read with RFC 5322 comment and quoting rules
 * (nested comments, quoted strings, quoted pairs). The receiving provider copies
 * text the sender chose (HELO, MAIL FROM) into its own verdict, so anything that
 * could carry structure from there is ambiguity, and ambiguity is never a pass.
 */
export type AuthResult={method:string;result:string;properties:Record<string,string>}
export type AuthResults={authserv:string;results:AuthResult[]}

// A quoted string or comment that holds a separator, a quote or a quoted pair is
// how sender text would reshape the header; honest provider verdicts never need one.
const STRUCTURAL=/[;()"\\=\s]/
/** Top-level `;`-separated segments with comments read as whitespace, or null when
 * the quoting or comments are unbalanced or ambiguous. */
function segments(value:string):string[]|null{
 const out:string[]=[];let current='',depth=0,quoted:string|null=null
 for(let index=0;index<value.length;index++){
  const char=value[index]
  if(quoted!==null){
   if(char==='\\')return null
   if(char==='"'){if(!quoted||STRUCTURAL.test(quoted))return null;current+=quoted;quoted=null}
   else quoted+=char
   continue
  }
  if(depth>0){
   if(char==='\\'||char==='"'||char===';')return null
   if(char==='(')depth++
   else if(char===')'&&--depth===0)current+=' '
   continue
  }
  if(char==='(')depth=1
  else if(char===')'||char==='\\')return null
  else if(char==='"')quoted=''
  else if(char===';'){out.push(current);current=''}
  else current+=char
 }
 if(depth>0||quoted!==null)return null
 out.push(current)
 return out
}
// Properties that name a domain hold only a domain (or, for HELO, an address literal);
// anything else there is sender text reshaping the verdict.
const DOMAIN=/^(?=.{1,253}\.?$)[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)*\.?$/i
const ADDRESS_LITERAL=/^\[(?:IPv6:)?[0-9a-f.:]+\]$/i
const DOMAIN_VALUED:Record<string,(value:string)=>boolean>={'header.d':value=>DOMAIN.test(value),'header.from':value=>DOMAIN.test(value),'smtp.helo':value=>DOMAIN.test(value)||ADDRESS_LITERAL.test(value)}
/** Each result must be exactly `method[/version]=result` followed by `reason=` and
 * `ptype.property=` values, each named once; anything else is ambiguous. */
function result(segment:string):AuthResult|null{
 const words=segment.replace(/\s*([=/])\s*/g,'$1').trim().split(/\s+/)
 const head=words.shift()?.match(/^([a-z0-9-]+)(?:\/\d+)?=([a-z0-9-]+)$/i)
 if(!head)return null
 const properties:Record<string,string>={}
 for(const word of words){
  const match=word.match(/^(reason|[a-z0-9-]+\.[a-z0-9-]+)=([\x21-\x7e]+)$/i),key=match?.[1].toLowerCase()
  if(!match||key! in properties||DOMAIN_VALUED[key!]&&!DOMAIN_VALUED[key!](match[2]))return null
  properties[key!]=match[2]
 }
 return {method:head[1].toLowerCase(),result:head[2].toLowerCase(),properties}
}
export function parseAuthenticationResults(value:string):AuthResults|null{
 const parts=segments(value)
 if(!parts)return null
 const [authserv,...rest]=parts,id=authserv.trim().match(/^([^\s=]+)(?:\s+\d+)?$/)?.[1]
 if(!id)return null
 if(rest.length===1&&rest[0].trim().toLowerCase()==='none')return {authserv:id.toLowerCase(),results:[]}
 const results=rest.map(result)
 return results.every(entry=>entry!==null)?{authserv:id.toLowerCase(),results:results as AuthResult[]}:null
}

// Cloudflare Email Routing copies the sender's HELO into its SPF result for that
// identity, and any text smuggled in there lands right after that entry, where an
// honest verdict has only the MAIL FROM's SPF result and ARC. It writes every DKIM
// result before DMARC, whose header.from carries the From domain, so a DKIM result
// after DMARC was smuggled in there. DMARC, each SPF identity and ARC appear once,
// and each SPF result names exactly one identity.
const ONCE=new Set(['dmarc','spf:smtp.helo','spf:smtp.mailfrom','arc'])
const AFTER_HELO=new Set(['spf:smtp.mailfrom','arc'])
const known=new Set(['dkim',...ONCE])
export function cloudflareConsistent(results:AuthResult[]){
 const seen=new Set<string>()
 for(const entry of results){
  let key=entry.method
  if(key==='spf'){
   const identities=['smtp.helo','smtp.mailfrom'].filter(name=>name in entry.properties)
   if(identities.length!==1)return false
   key=`spf:${identities[0]}`
  }
  if(!known.has(key))continue
  if(ONCE.has(key)&&seen.has(key)||seen.has('spf:smtp.helo')&&!AFTER_HELO.has(key)||key==='dkim'&&seen.has('dmarc'))return false
  seen.add(key)
 }
 return true
}
