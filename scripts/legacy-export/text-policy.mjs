import {omitTransportCredentials,omitTransportObject,omitBasicAuthorization} from './transport-secrets.mjs';
import {opaqueCredentialShape,opaqueReferences,publicSentryEndpoint} from './references.mjs';
// Explicit omission policy for rendered support text. Unknown credential-like
// assignments, JSON fields and opaque payloads still fail in secrets.mjs.
const credentialName=/(?:key|secret|token|password|salt|credential|encrypt(?:ion)?)$/i;
const reviewedNames=new Set(['key','secret','token','password','credential','credentials','secret_key','secretkey','api_key','api_token','access_token','accesstoken','client_secret','clienttoken','authorizationfingerprint','auth_token','merchant_account_key','x-api-key','example_key','public_key','publickey','refresh_token','refreshtoken','csrf_token','csrftoken','x-amz-credential']);
const textColumns={messages:['content'],events:['payload'],insights:['content'],articles:['content'],macros:['content']};
const derivedColumns={contacts:['ai_profile','metadata'],users:['ai_profile'],projects:['ai_profile'],conversations:['metadata'],dataset_files:['markdown'],datasets:['metadata'],project_optimizations:['ai_profile','metadata'],message_thinkings:['content'],support_delegations:['instructions','context','result'],support_delegation_events:['message','payload'],insights:['analysis','metadata'],leads:['content']};
const rendered=(table,column)=>textColumns[table]?.includes(column);
export const sanitizable=(table,column)=>rendered(table,column)||derivedColumns[table]?.includes(column);
const userinfo=/\b([a-z][a-z0-9+.-]*:\/\/)([^\s/@:"'<>()[\]]+):([^\s/@"'<>()[\]]+)@/gi;
// Mail clients wrap addresses as "https://mailto:support@example.com": an address, not user:password.
export const mailtoLink=user=>user.toLowerCase()==='mailto';
export function isRedactedCredentialField(table,column,key,value){return rendered(table,column)&&reviewedName(key)&&value==='<redacted>';}
function reviewedName(name){return reviewedNames.has(name.toLowerCase())||/^(?:[A-Z][A-Z0-9]*_)+(?:KEY|TOKEN|SECRET|PASSWORD)$/.test(name);}
function symbolic(value){
 return /^(?:\$\{?[A-Z][A-Z0-9_]*\}?|!?\!?process\.env\.[A-Z][A-Z0-9_]*)$/.test(value)
  || /^(?:\.{3}|\*{3,}|<redacted>|\[redacted\]|REDACTED|<YOUR[_A-Z0-9 -]+>|(?:YOUR|DEIN)[_-][A-Z0-9_-]*(?:KEY|TOKEN|PASSWORD|SECRET)[_A-Z0-9-]*)$/i.test(value);
}
function* assignments(text){
 const pattern=/\b([A-Za-z][\w-]*)(["']?[ \t]*([:=])[ \t]*)(?:"((?:\\.|[^"\\\r\n])*)"|'((?:\\.|[^'\\\r\n])*)'|([^\s"',;}]+))/g;
 for(let m;(m=pattern.exec(text));){
  const quote=m[4]!==undefined?'"':m[5]!==undefined?"'":'',value=m[4]??m[5]??m[6];
  yield {raw:m[0],index:m.index,name:m[1],operator:m[3],quote,value,head:m[0].slice(0,m[0].length-value.length-(quote?1:0)),prefix:text.slice(0,m.index),tail:text.slice(m.index+m[0].length)};
  // An unquoted value can hold its own assignment ("Diagnostic: API_KEY=..."); rescan it.
  if(m[6]!==undefined)pattern.lastIndex=m.index+m[0].length-m[6].length;
 }
}
function publicLink(value){
 try{const url=new URL(value);return /^https?:$/.test(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash&&!opaqueCredentialShape(value);}catch{return false;}
}
function noncredential(a){
 const {name,operator,quote,tail,prefix}=a,value=a.value.replace(/^`|`$/g,'');
 if(!value||symbolic(value)||value==='sk-...')return true;
 if(name==='Encryption'&&operator===':')return true;
 // Slack/Markdown emoji shortcodes (":key: Double-check") label prose; they assign nothing.
 if(operator===':'&&!quote&&/(?:^|[\s>(*_~[]):$/.test(prefix)&&/^[a-z0-9_+-]+$/.test(name))return true;
 // A public link ("reset password: https://…/password/reset") is not the credential itself.
 // Capability-shaped URLs still go through the URL omission below.
 if(!quote&&publicLink(value))return true;
 // The public DSN key inside an exact Sentry ingest URL (see references.mjs).
 if(name==='sentry_key'&&operator==='='&&!quote){const start=prefix.search(/https?:\/\/[^\s<>"'()[\]]*$/);if(start>=0&&publicSentryEndpoint(prefix.slice(start)+a.raw+(tail.match(/^[^\s<>"'()[\]]*/)?.[0]??'')))return true;}
 if(/^Idempotency-Key$/i.test(name)||name.toLowerCase()==='key'&&/\bidempotency\s+$/i.test(prefix))return true;
 if(operator===':'&&/^YOUR_[A-Z_]+$/.test(name)&&['\\','-d','-X','-H'].includes(value))return true;
 if(operator===':'&&!quote&&/^(?:true|false|null|undefined|None)$/.test(value))return true;
 // References in code examples do not carry the referenced credential's value.
 if(!quote&&operator==='='&&name==='secret'&&value==='new'&&/^ TextEncoder\(\)\.encode\(process\.env\.[A-Z_][A-Z0-9_]*\)/.test(tail))return true;
 if(!quote&&operator==='='&&name==='token'&&value==='request.cookies.get('&&/^["'][A-Za-z_][A-Za-z0-9_]*["']\)\?\.value/.test(tail))return true;
 if(!quote&&operator===':'&&name==='Key'&&value==='你的'&&/^ (?:API Key|key)\b/.test(tail))return true;
 if(!quote&&operator==='='&&name==='key'&&value==='Codex'&&/^ imagegen\b/.test(tail))return true;
 return false;
}
export function hasCredentialAssignment(text){
 for(const a of assignments(text))if(credentialName.test(a.name)&&!/Error$/.test(a.name)&&!noncredential(a))return true;
 return false;
}
export function omitSupportCredentials(table,column,value,onOmit){
 if(!sanitizable(table,column)||value===null)return {value,omitted:0};
 if(typeof value==='object'){
  let omitted=0;const cleaned=omitTransportObject(value,secret=>{omitted++;onOmit?.(secret);return '<redacted>';});const transform=v=>{const r=omitSupportCredentials(table,column,v,onOmit);omitted+=r.omitted;return r.value;};
  const mapped=Array.isArray(cleaned)?cleaned.map(transform):Object.fromEntries(Object.entries(cleaned).map(([key,v])=>[key,transform(v)]));
  return {value:omitted?mapped:value,omitted};
 }
 if(typeof value!=='string')return {value,omitted:0};
 let omitted=0;
 const removed=secret=>{omitted++;onOmit?.(secret);return '<redacted>';};
 // JSON diagnostic bodies can carry HAR cookie/header objects as well as prose.
 try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object'){const before=omitted;const cleaned=omitTransportObject(parsed,removed);if(omitted!==before)value=JSON.stringify(cleaned);}}catch{}
 value=omitTransportCredentials(value,removed);
 let result='',offset=0;
 for(const a of assignments(value)){
  if(a.index<offset||!reviewedName(a.name)||noncredential(a))continue;
  result+=value.slice(offset,a.index)+a.head+removed(a.value)+a.quote;offset=a.index+a.raw.length;
 }
 value=result+value.slice(offset);
 // Known authentication signatures are omitted, rather than copied to custody.
 value=value.replace(/-----BEGIN ([A-Z ]*PRIVATE KEY|ENCRYPTED[A-Z ]*)-----[\s\S]*?-----END \1-----/g,removed);
 value=value.replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,removed);
 value=value.replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,removed);
 value=value.replace(/\b(?:(?:pi|seti)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+|whsec_[A-Za-z0-9]{16,})\b/g,removed);
 value=value.replace(/\b(?:cs_(?:live|test)_[A-Za-z0-9_]{16,}|tok_[A-Za-z0-9]{16,})\b/g,removed);
 value=value.replace(/\b[A-Za-z0-9_.+-]{40,}@(?:mail\.)?chargedesk\.com\b/gi,removed);
 value=value.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,removed);
 value=value.replace(/\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}|\$argon2(?:id|i|d)\$[^\s"'<>]+/g,removed);
 value=value.replace(/\b(Bearer)[ \t]+([A-Za-z0-9+/_.=-]{12,})/gi,(_match,scheme,secret)=>scheme+' '+removed(secret));
 value=omitBasicAuthorization(value,removed);
 value=value.replace(/([?&](?:amp;)?)(\\?_s|api_key|api_token|access_token|client_secret|auth_token|token|signature|X-Amz-Signature|X-Amz-Credential|X-Amz-Security-Token|AWSAccessKeyId|resourcekey|code|otp|password|auth)=([^&\s<>"'()[\]]+)/gi,(_match,prefix,name,secret)=>prefix+name+'='+removed(secret));
 value=value.replace(userinfo,(match,scheme,user,secret)=>mailtoLink(user)?match:scheme+removed(user+':'+secret)+'@');
 value=value.replace(/https?:\/\/[^\s<>"'()[\]]+/g,url=>opaqueCredentialShape(url)?removed(url):url);
 // Opaque diagnostic values have no established public-resource meaning.
 // Omit them as potential credentials; unknown schema/JSON/assignment names
 // still stop export. Never turn an encrypted JSON envelope into readable data.
 const opaque=new Set([...opaqueReferences(value).matchAll(/[A-Za-z0-9+/_-]{32,}={0,2}/g)].map(m=>m[0]).filter(opaqueCredentialShape));
 value=value.replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g,token=>{
  if(![...opaqueReferences(token).matchAll(/[A-Za-z0-9+/_-]{32,}={0,2}/g)].some(m=>opaque.has(m[0])))return token;
  try{const decoded=JSON.parse(Buffer.from(token,'base64').toString('utf8'));if(decoded&&'iv'in decoded&&'value'in decoded&&('mac'in decoded||'tag'in decoded))return token;}catch{}
  return removed(token);
 });
 return {value,omitted};
}

// A credential removed from one support text is removed wherever else the project's
// rendered or derived text repeats it ("enter the manual key `…`"). The exporter
// collects these values first; length matches the secret scan's searched values.
export const repeatedCredentialMinimum=12;
const tokenCharacter=/[A-Za-z0-9+/_=-]/;
export function knownCredentials(secrets){
 // Index both stored forms by a fixed-length prefix: one linear pass per string.
 const forms=new Map();
 for(const secret of secrets)if(secret.length>=repeatedCredentialMinimum)for(const form of new Set([secret,JSON.stringify(secret).slice(1,-1)])){
  const key=form.slice(0,repeatedCredentialMinimum);if(!forms.has(key))forms.set(key,[]);forms.get(key).push(form);
 }
 for(const list of forms.values())list.sort((a,b)=>b.length-a.length);
 return forms;
}
export function omitKnownCredentials(value,known,onOmit){
 if(!known.size||value===null||value===undefined)return {value,omitted:0};
 let omitted=0;
 const clean=v=>{
  if(typeof v==='string'){
   let result='',last=0;
   for(let i=0;i+repeatedCredentialMinimum<=v.length;){
    const form=known.get(v.substr(i,repeatedCredentialMinimum))?.find(f=>v.startsWith(f,i));
    if(!form){i++;continue;}
    // Inside a longer token the whole token goes: a remnant would still be part of the credential.
    let start=i,end=i+form.length;
    while(start>last&&tokenCharacter.test(v[start-1]))start--;
    while(end<v.length&&tokenCharacter.test(v[end]))end++;
    result+=v.slice(last,start)+'<redacted>';i=end;last=end;omitted++;onOmit?.(form);
   }
   return last?result+v.slice(last):v;
  }
  if(Array.isArray(v))return v.map(clean);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([key,item])=>[key,clean(item)]));
  return v;
 };
 const cleaned=clean(value);
 return {value:omitted?cleaned:value,omitted};
}
