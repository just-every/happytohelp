const redacted=value=>!value||['<redacted>','[redacted]'].includes(value);
const header=name=>/^(?:set-)?cookies?$/i.test(name);
const cookieNames=/\b((?:CDSZ\d*|CSRFC(?:-legacy)?|cf_clearance|__cf_bm|__cfruid|PHPSESSID|JSESSIONID|laravel_session|connect\.sid))([ \t]*=[ \t]*)([^;\s"'<>]+)/gi;
const headers=/(^|\r?\n)([ \t]*(?:set-)?cookies?(?:[ \t]*:[ \t]*|[ \t]*\r?\n))([^\r\n]+)/gim;
const inlineHeaders=/\b((?:set-)?cookies?[ \t]*:[ \t]*)([^\r\n]+)/gi;
// HAR fragments that are not complete JSON: a cookie header's name/value pair, and each
// value of a "cookies" array, up to its closing bracket or the end of the text.
const harCookiePair=/("name"\s*:\s*"(?:set-)?cookies?"\s*,\s*"value"\s*:\s*")((?:\\.|[^"\\])*)"|("value"\s*:\s*")((?:\\.|[^"\\])*)("\s*,\s*"name"\s*:\s*"(?:set-)?cookies?")/gi;
const harCookies=/"cookies"\s*:\s*\[[^\]]*/gi;
const harValue=/("value"\s*:\s*")((?:\\.|[^"\\])*)"/g;
const inputs=/<input\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const authInput=name=>/^(?:_s|_token|csrf(?:_?token)?|_csrf|csrfmiddlewaretoken|authenticity_token|__RequestVerificationToken|access_token|auth_token|token|password|secret)$/i.test(name);
function attributes(tag){return [...tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>({name:m[1].toLowerCase(),value:m[2]??m[3]??m[4],raw:m[0]}));}
function secretInput(tag){const attrs=attributes(tag),name=attrs.find(a=>a.name==='name')?.value,type=attrs.find(a=>a.name==='type')?.value;return (authInput(name||'')||type?.toLowerCase()==='password')?attrs.find(a=>a.name==='value'):undefined;}
export function hasTransportCredentials(text){
 for(const m of text.matchAll(headers))if(!redacted(m[3].trim())&&/\b[-\w.]+\s*=/.test(m[3]))return true;
 for(const m of text.matchAll(inlineHeaders))if(!redacted(m[2].trim())&&/\b[-\w.]+\s*=/.test(m[2]))return true;
 for(const m of text.matchAll(cookieNames))if(!redacted(m[3]))return true;
 for(const m of text.matchAll(harCookiePair))if(!redacted(m[2]??m[4]))return true;
 for(const m of text.matchAll(harCookies))for(const v of m[0].matchAll(harValue))if(!redacted(v[2]))return true;
 if(/(?:^|[\s'"`(])(?:-b|--cookie)(?:[ \t]+|=)["']?(?!<redacted>|\[redacted\])[^\s"'`]*=/.test(text))return true;
 for(const m of text.matchAll(inputs)){const value=secretInput(m[0])?.value;if(value&&!redacted(value))return true;}
 return false;
}
export function transportObject(value,path=[]){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(header(String(value.name||''))&&typeof value.value==='string'&&!redacted(value.value))return true;
 if(path.at(-2)==='cookies'&&typeof value.name==='string'&&typeof value.value==='string'&&!redacted(value.value))return true;
 return Object.entries(value).some(([key,v])=>header(key)&&typeof v==='string'&&!redacted(v));
}
export function omitTransportObject(value,removed,path=[]){
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map((v,i)=>omitTransportObject(v,removed,[...path,String(i)]));
 const result={...value};
 if((header(String(value.name||''))||path.at(-2)==='cookies')&&typeof value.value==='string'&&!redacted(value.value))result.value=removed(value.value);
 for(const [key,v]of Object.entries(value)){
  if(header(key)&&typeof v==='string'&&!redacted(v))result[key]=removed(v);
  else if(v&&typeof v==='object')result[key]=omitTransportObject(v,removed,[...path,key]);
 }
 return result;
}
export function omitTransportCredentials(value,removed){
 value=value.replace(headers,(match,start,name,contents)=>/\b[-\w.]+\s*=/.test(contents)&&!redacted(contents.trim())?start+name+removed(contents):match);
 value=value.replace(inlineHeaders,(match,name,contents)=>/\b[-\w.]+\s*=/.test(contents)&&!redacted(contents.trim())?name+removed(contents):match);
 value=value.replace(harCookiePair,(match,head,secret,head2,secret2,tail)=>head!==undefined?(redacted(secret)?match:head+removed(secret)+'"'):(redacted(secret2)?match:head2+removed(secret2)+tail));
 value=value.replace(harCookies,list=>list.replace(harValue,(match,head,secret)=>redacted(secret)?match:head+removed(secret)+'"'));
 value=value.replace(cookieNames,(match,name,separator,secret)=>redacted(secret)?match:name+separator+removed(secret));
 value=value.replace(inputs,tag=>{const value=secretInput(tag);if(!value||redacted(value.value))return tag;removed(value.value);return tag.replace(value.raw,value.raw.replace(value.value,'[redacted]'));});
 return value;
}

// One recognizer serves extraction and validation, including pasted folded text.
// curl's "-u user:password" and "-u key:" are Basic credentials too; placeholders stay.
// A placeholder is an explicit documentation form, never an all-uppercase word by case alone.
const placeholderWord='API|SECRET|ACCESS|AUTH|PRIVATE|PUBLIC|CLIENT|ACCOUNT|APP|APPLICATION|PUBLISHABLE|RESTRICTED|LIVE|TEST|STRIPE|USER|USERNAME|PASSWORD|PASS|KEY|TOKEN|SID|ID|LOGIN|EMAIL|SK|PK|RK|MY|YOUR|NAME|VALUE';
const placeholderForm=new RegExp(String.raw`^(?:|\$\{?\w+\}?|<[^>]*>|\[[^\]]*\]|\{\{?[^}]*\}\}?|(?:YOUR|MY)[_-][A-Za-z0-9_-]+|(?:${placeholderWord})(?:[_-](?:${placeholderWord}))*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:KEY|TOKEN|SECRET|PASSWORD|SID|ID|USER)|x{3,}|X{3,}|\*{3,}|\.{3,}|…)$`);
export const placeholder={test:value=>placeholderForm.test(value.replaceAll('\\_','_').replaceAll('\uE000',''))};
export function omitBasicAuthorization(value,removed){
 value=value.replace(/(^|[\s'"`(])(-u|--user)([ \t]+|=)(["']?)([^\s"'`:]*):([^\s"'`]*)\4/g,(match,start,flag,separator,quote,user,secret)=>(user||secret)&&!(placeholder.test(user)&&placeholder.test(secret))?start+flag+separator+quote+removed(user+':'+secret)+quote:match);
 // curl -b/--cookie with name=value pairs (a cookie-jar file name has no "=").
 value=value.replace(/(^|[\s'"`(])(-b|--cookie)([ \t]+|=)(?:(["'])([^"'\r\n]*=[^"'\r\n]*)\4|([^\s"'`]*=[^\s"'`]*))/g,(match,start,flag,separator,quote='',quoted,bare)=>{const contents=quoted??bare;return redacted(contents)?match:start+flag+separator+quote+removed(contents)+quote;});
 value=value.replace(/(\bAuthorization[ \t]*:[ \t]*Basic[ \t]+)([^\s]+)/gi,(match,head,secret)=>/^(?:<redacted>|\[redacted\])/.test(secret)?match:head+removed(secret));
 return value.replace(/(\bBasic\s+)([A-Za-z0-9+/]+={0,2})/gi,(match,head,secret)=>{
  const bytes=Buffer.from(secret,'base64');return bytes.toString('base64').replace(/=+$/,'')===secret.replace(/=+$/,'')&&bytes.includes(0x3a)?head+removed(secret):match;
 });
}
export function hasBasicAuthorization(value){let found=false;omitBasicAuthorization(value,()=>{found=true;return '<redacted>';});return found;}
