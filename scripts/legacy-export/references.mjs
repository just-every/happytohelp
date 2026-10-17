import {createPublicKey} from 'node:crypto';
// Noncredential identifiers in support history. Strong authentication signatures
// are always checked against the original text by secrets.mjs.
const publicConfiguration=new Set([
 'data.clientConfiguration.paypal.clientId',
 'data.clientConfiguration.paypal.braintreeClientId',
 'data.clientConfiguration.usBankAccount.plaidPublicKey',
]);
export function publicConfigurationValue(table,column,path){return table==='messages'&&column==='content'&&publicConfiguration.has(path.join('.'));}
export function publicConfigurationName(table,column,path,key,value){
 return publicConfigurationValue(table,column,[...path,key])||table==='messages'&&column==='content'&&[...path,key].join('.')==='data.tokenizeUsBankAccount'&&(value===null||typeof value==='object'&&!Array.isArray(value));
}
// Sentry DSN public keys ship in every client page; Sentry documents them as safe to expose.
function sentryEndpoint(url){
 return /^(?:sentry\.io|o\d+\.ingest(?:\.[a-z]{2})?\.sentry\.io)$/.test(url.hostname)&&/^\/api\/\d+\/(?:security|store|envelope|minidump)\/?$/.test(url.pathname)
  &&url.searchParams.has('sentry_key')&&[...url.searchParams].every(([key,value])=>key==='sentry_key'?/^[a-f0-9]{32}$/.test(value):/^sentry_(?:version|client|environment|release)$/.test(key));
}
export function publicSentryEndpoint(raw){try{return sentryEndpoint(new URL(raw.replaceAll('&amp;','&')));}catch{return false;}}
function gravatar(url){
 if(!['gravatar.com','www.gravatar.com','secure.gravatar.com'].includes(url.hostname)||!/^\/avatar\/(?:[a-f0-9]{32}|[a-f0-9]{64})(?:\.jpg)?$/i.test(url.pathname))return false;
 return [...url.searchParams].every(([key,value])=>{
  if(['s','size'].includes(key))return /^\d{1,4}$/.test(value);
  if(['r','rating'].includes(key))return /^(g|pg|r|x)$/.test(value);
  if(['d','default'].includes(key)){if(/^(404|mp|mm|identicon|monsterid|wavatar|retro|robohash|blank)$/.test(value))return true;try{const image=new URL(value);return /^https?:$/.test(image.protocol)&&!image.username&&!image.password&&!image.search&&!image.hash&&/\.(?:png|jpe?g|gif|webp|svg)$/i.test(image.pathname);}catch{}}
  return false;
 });
}
export function opaqueReferences(value){
 const withoutFiles=value.replaceAll('\\_','_').replaceAll('\\-','-').replace(/(^|[\s"'`(])\/(?:Users|home|tmp|private|var|workspace|mnt|opt|app|usr|root)\/[^\s"'`<>)]+/g,'$1<file-path>')
  // Rackspace Cloud Files public CDN container hostnames (DNS names, not capabilities).
  .replace(/\b[a-f0-9]{20}-[a-f0-9]{32}(?=\.(?:ssl|r\d+)\.cf\d\.rackcdn\.com\b)/gi,'cdn-container')
  // A Markdown link labelled with an attachment's file name: names are exported as customer data.
  .replace(/\[[^\]\r\n]{1,255}?\.(?:png|jpe?g|gif|webp|heic|svg|pdf|txt|docx?|xlsx?|csv|zip|log|json|mov|mp4)\]\(/gi,'[attachment-filename](');
 const urls=withoutFiles.replace(/https?:\/\/[^\s<>"'()[\]]+/g,raw=>{
  try{
   const url=new URL(raw.replaceAll('&amp;','&'));if(url.username||url.password)return raw;
   if(gravatar(url))return '<avatar-resource>';
   if(sentryEndpoint(url))return '<error-reporting-endpoint>';
   for(const key of [...url.searchParams.keys()])if(key==='fbclid'||/^utm_(?:source|medium|campaign|content|term|id)$/.test(key))url.searchParams.delete(key);
   // Document IDs are separate from OAuth/resource-key access capabilities.
   if(['docs.google.com','drive.google.com'].includes(url.hostname)){
    url.pathname=url.pathname.replace(/(\/(?:document|spreadsheets|presentation|file)\/d\/)[A-Za-z0-9_-]+/g,'$1document-id');
    if(/^\/(?:uc|thumbnail|files\/[^/]+\/export)/.test(url.pathname))for(const key of ['id','revid'])if(url.searchParams.has(key))url.searchParams.set(key,'document-id');
   }
   if(url.hostname==='zapier.com'&&/^\/(?:developer|platform)\/public-invite\/[^/]+\/[^/]+\/?$/.test(url.pathname)&&!url.search&&!url.hash)return '<public-integration-invitation>';
   // Public video and playlist links (youtube.com/watch?v=…&list=PL…, youtu.be/…) carry no credential.
   if(/^(?:(?:www\.|m\.|music\.)?youtube\.com|youtu\.be)$/.test(url.hostname))return '<video-resource>';
   if(url.search||url.hash)return url.href;
   if(/\.(?:webp|png|jpe?g|gif|svg|ico)$/i.test(url.pathname))return '<image-resource>';
   if(['loom.com','www.loom.com'].includes(url.hostname)&&/^\/(?:share|embed)\/[a-f0-9]{32}\/?$/i.test(url.pathname))return '<video-resource>';
   return url.hostname.replaceAll('.',' ')+url.pathname.replaceAll('/',' ');
  }catch{return raw;}
 });
 return urls.replace(/\bcid:[A-Za-z0-9@._-]+/gi,'<content-id>')
  .replace(/\b(?:cus|ch|pi|sub|in|pm|src|price|prod|plan|re|txn|evt|acct|seti|dp|po|ba|card|il|ca)_[A-Za-z0-9_]+\b/g,token=>token.includes('_secret_')?token:'<payment-resource-id>')
  .replace(/\bsha(256|384|512)-([A-Za-z0-9+/]+={0,2})/g,(match,bits,digest)=>{const bytes=Buffer.from(digest,'base64');return bytes.length===Number(bits)/8&&bytes.toString('base64').replace(/=+$/,'')===digest.replace(/=+$/,'')?'<integrity-checksum>':match;})
  .replace(/\bk=rsa;[ \t]*p=([A-Za-z0-9+/]+={0,2})/gi,(match,key)=>{try{createPublicKey({key:Buffer.from(key,'base64'),format:'der',type:'spki'});return '<public-dkim-key>';}catch{return match;}})
  .replace(/\b[a-f0-9]{32,64}\.(?:png|jpe?g|gif|webp|svg|pdf|txt|docx?|xlsx?|csv|zip|log|json)\b/gi,'attachment-filename').replace(/(?<![a-f0-9])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![a-f0-9])/gi,'<uuid>');
}

// Conservative omission boundary for unverified URL capabilities. Public
// resource formats above remain references; arbitrary opaque URLs do not.
export function opaqueCredentialShape(value){
 const normalized=opaqueReferences(value).replace(/\bpk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,'<publishable-application-id>');
 if(/\b[a-f0-9]{32,}\b/i.test(normalized))return true;
 return [...normalized.matchAll(/[A-Za-z0-9+/_-]{32,}={0,2}/g)].some(m=>randomToken(m[0].replace(/=+$/,'')));
}
// A run of 32+ characters is a credential when its character entropy is what a random
// string of that length over its own alphabet would show. The expected value carries
// Miller-Madow's small-sample bias, so short and long secrets meet the same bar: about
// 99% of random mixed-case alphanumerics of 32 or more characters. Lowercase-and-digit
// runs (content hashes, client ids) keep the fixed bar for 40+ characters. Paths and
// slugs of words, numbers, units and dates ("2024-10-16-how-we-migrated-v2", "16px") are not random.
function randomToken(text){
 if(!/[A-Za-z]/.test(text)||!/[0-9]/.test(text))return false;
 if(/[-_/+]/.test(text)&&text.split(/[-_/+]+/).every(part=>/^(?:[A-Za-z]+[0-9]*|[0-9]+[a-z]{0,3})?$/.test(part)))return false;
 const counts=new Map();for(const char of text)counts.set(char,(counts.get(char)||0)+1);
 let entropy=0;for(const n of counts.values()){const p=n/text.length;entropy-=p*Math.log2(p);}
 if(text.length>=40&&entropy>4.8)return true;
 if(!/[a-z]/.test(text)||!/[A-Z]/.test(text))return false;
 const alphabet=62+new Set(text.replace(/[A-Za-z0-9]/g,'')).size;
 return entropy>=Math.log2(alphabet)-(alphabet-1)/(2*text.length*Math.LN2)-0.5;
}
