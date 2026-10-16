const redacted=value=>!value||['<redacted>','[redacted]'].includes(value);
const header=name=>/^(?:set-)?cookies?$/i.test(name);
const cookieNames=/\b((?:CDSZ\d*|CSRFC(?:-legacy)?|cf_clearance|__cf_bm|__cfruid|PHPSESSID|JSESSIONID|laravel_session|connect\.sid))([ \t]*=[ \t]*)([^;\s"'<>]+)/gi;
const headers=/(^|\r?\n)([ \t]*(?:set-)?cookies?(?:[ \t]*:[ \t]*|[ \t]*\r?\n))([^\r\n]+)/gim;
const inlineHeaders=/\b((?:set-)?cookies?[ \t]*:[ \t]*)([^\r\n]+)/gi;
const inputs=/<input\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const authInput=name=>/^(?:_s|_token|csrf(?:_?token)?|_csrf|csrfmiddlewaretoken|authenticity_token|__RequestVerificationToken|access_token|auth_token|token|password|secret)$/i.test(name);
function attributes(tag){return [...tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>({name:m[1].toLowerCase(),value:m[2]??m[3]??m[4],raw:m[0]}));}
function secretInput(tag){const attrs=attributes(tag),name=attrs.find(a=>a.name==='name')?.value,type=attrs.find(a=>a.name==='type')?.value;return (authInput(name||'')||type?.toLowerCase()==='password')?attrs.find(a=>a.name==='value'):undefined;}
export function hasTransportCredentials(text){
 for(const m of text.matchAll(headers))if(!redacted(m[3].trim())&&/\b[-\w.]+\s*=/.test(m[3]))return true;
 for(const m of text.matchAll(inlineHeaders))if(!redacted(m[2].trim())&&/\b[-\w.]+\s*=/.test(m[2]))return true;
 for(const m of text.matchAll(cookieNames))if(!redacted(m[3]))return true;
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
 value=value.replace(cookieNames,(match,name,separator,secret)=>redacted(secret)?match:name+separator+removed(secret));
 value=value.replace(inputs,tag=>{const value=secretInput(tag);if(!value||redacted(value.value))return tag;removed(value.value);return tag.replace(value.raw,value.raw.replace(value.value,'[redacted]'));});
 return value;
}

// One recognizer serves extraction and validation, including pasted folded text.
export function omitBasicAuthorization(value,removed){
 value=value.replace(/(\bAuthorization[ \t]*:[ \t]*Basic[ \t]+)([^\s]+)/gi,(match,head,secret)=>/^(?:<redacted>|\[redacted\])/.test(secret)?match:head+removed(secret));
 return value.replace(/(\bBasic\s+)([A-Za-z0-9+/]+={0,2})/gi,(match,head,secret)=>{
  const bytes=Buffer.from(secret,'base64');return bytes.toString('base64').replace(/=+$/,'')===secret.replace(/=+$/,'')&&bytes.includes(0x3a)?head+removed(secret):match;
 });
}
export function hasBasicAuthorization(value){let found=false;omitBasicAuthorization(value,()=>{found=true;return '<redacted>';});return found;}
