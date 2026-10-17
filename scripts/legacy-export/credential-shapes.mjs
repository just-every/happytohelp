// Credential shapes that need no reviewed assignment name: provider prefixes and
// webhook hosts, prose labels ("my password is …"), and values wrapped across a line.
// The text policy removes them; the validator refuses any that remain.

// Provider credentials recognized by their own prefix or host.
export const prefixedCredential=new RegExp([
 String.raw`\bxox[abposre]-[A-Za-z0-9-]{10,}`,
 String.raw`\bxapp-\d-[A-Za-z0-9-]{10,}`,
 String.raw`https?:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[^\s<>"'()[\]]+`,
 String.raw`https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+`,
 String.raw`\bshp(?:at|ss|ca|pa)_[A-Fa-f0-9]{32}\b`,
 String.raw`\bgl(?:pat|dt|rt|ptt|oas|cbt|imt|soat|ffct)-[A-Za-z0-9_-]{20,}`,
 String.raw`\bpat-(?:na|eu|ap)\d-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`,
 String.raw`\bGOCSPX-[A-Za-z0-9_-]{20,}`,
 String.raw`\bAIza[A-Za-z0-9_-]{35}`,
 String.raw`\b1\/\/0[A-Za-z0-9_-]{40,}`,
 String.raw`\bnpm_[A-Za-z0-9]{36}\b`,
 String.raw`\bATATT[A-Za-z0-9_=-]{30,}`,
 String.raw`\bEAA[A-Za-z0-9][A-Za-z0-9_-]{40,}`,
 String.raw`\baccess_token\$(?:production|sandbox)\$[a-z0-9]{16}\$[a-f0-9]{32}`,
 String.raw`\bkey-[a-f0-9]{32}\b`,
 String.raw`\b[a-f0-9]{32}-us\d{1,2}\b`,
 // Telegram bot tokens and Discord bot tokens.
 String.raw`\b\d{8,10}:AA[A-Za-z0-9_-]{30,}`,
 String.raw`\b[MNO][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}`,
].join('|'),'g');

// A secret written in prose: a label, then "is", a colon or (for longer values) a space.
const labels='passwords?|passwort|passwd|passcode|passphrase|pass|pw|contraseña|mot de passe|parola|senha|wachtwoord|secret|token|api key|key';
const labelled=new RegExp(String.raw`(?<![\p{L}\p{N}_-])(${labels})(\s+(?:is|was|ist|est|es|è)(?:\s+(?:now|still))?\s*:?\s+|\s*[:=]\s*|\s+)(["'\x60]?)(?:\*{1,2}|_{1,2})?([^\s"'\x60<>()[\]*]+)`,'giu');
const redactedMarker=/^(?:<redacted>|\[redacted\])/;
// A value with a digit, an inner capital or a symbol; ordinary words ("is required",
// "is incorrect!") are not one.
const commonWords=new Set('incorrect correct wrong invalid valid required missing expired empty blank weak strong changed reset forgotten lost locked same different sensitive case-sensitive working accepted rejected ok okay fine right good bad secure insecure set saved stored hidden shown visible displayed encrypted protected compromised unknown temporary generated updated simple complex long short longer shorter too still also now being already not the a an your my their our this that it here there below above attached'.split(' '));
export function plainWord(value){const word=value.replace(/[!?.,;:]+$/,'');return /^(?:[a-z]+|[A-Z][a-z]+|[A-Z]+)(?:-[a-z]+)*$/.test(word)&&word.split('-').every(pronounceable);}
export function secretLike(value){
 if(/^[A-Z2-7]{16,}$/.test(value))return true;
 if(commonWords.has(value.replace(/[!?.,;:]+$/,'').toLowerCase()))return false;
 return /[A-Za-z]/.test(value)&&(/\d/.test(value)||/[a-z][A-Z]/.test(value)||/[A-Z]{2}[a-z]|[a-z]{2,}[A-Z]{2}/.test(value)||/[!@#$%^&+=?~]/.test(value));
}
function pronounceable(word){const w=word.toLowerCase();return (w.match(/[aeiouy]/g)||[]).length/w.length>=0.25&&!/[^aeiouy]{4}/.test(w);}
export function* labelledValues(text){
 for(const m of text.matchAll(labelled)){
  const [,label,joint,quote,raw]=m,value=raw.replace(/[.,;:?)\]]+$/,'');
  // Links are judged by the URL rules: a public link after "password:" stays.
  if(!value||!/^[\x21-\x7e]+$/.test(value)||redactedMarker.test(value)||/^[a-z][a-z0-9+.-]*:\/\//i.test(value)||!secretLike(value))continue;
  // Bare "token X" needs a long value; "password is X" and "contraseña: X" need six characters.
  // A bare "key X" (a 2FA "manual key `…`") needs 16 characters of letters and digits or base32.
  if(value.length<(/^\s+$/.test(joint)?12:6))continue;
  if(/^\s+$/.test(joint)&&!/^(?:secret|token|passwords?|passcode|key)$/i.test(label))continue;
  if(/^\s+$/.test(joint)&&/^key$/i.test(label)&&!(value.length>=16&&(/\d/.test(value)&&/[A-Za-z]/.test(value)||/^[A-Z2-7]{16,}$/.test(value))))continue;
  yield {index:m.index+m[0].length-raw.length,value,label};
 }
}
export function omitLabelledValues(text,removed){
 let result='',offset=0;
 for(const {index,value} of labelledValues(text)){if(index<offset)continue;result+=text.slice(offset,index)+removed(value);offset=index+value.length;}
 return result+text.slice(offset);
}

// Wrapped values. The policy marks each value it removes with wrapMark; when that value
// ends a line (Markdown's hard break included), the next line's leading token continues
// it and is removed too. After a marker already in the text, whose kind is unknown, only
// a key-shaped token continues it (a digit and a letter, or a long mixed-case run): up to
// three such lines, as a wrapped link or key leaves them.
export const wrapMark='';
const quoteMarks=String.raw`(?:>[ \t]?)*`;
const continuationToken=String.raw`[^\s"'\x60<>()[\]{}]+`;
export function keyShaped(token){return token.length>=8&&!/^[A-Za-z_][\w.-]*(?::|=.)/.test(token)&&(/\d/.test(token)&&/[A-Za-z]/.test(token)||token.length>=16&&/[a-z]/.test(token)&&/[A-Z]/.test(token.slice(1)));}
const taggedContinuation=new RegExp(String.raw`<redacted>${wrapMark}( {2,}|\\)?(\r?\n${quoteMarks})(${continuationToken})`,'g');
// The next line starts something new when it opens with a name ("MAIL_HOST=…", "Accept:")
// or a common word that starts a line ("Thanks", "ok").
const lineStart=new Set('ok okay thanks thank thx regards cheers best kind hi hello hey dear please pls sorry yes no yeah the and but so then also i im we you it its this that there here can could would should will is are was were what when where why how let if or not my our your his her their for from to in on at of with as by also'.split(' '));
function continues(token){return !/^[A-Za-z_][\w.-]*(?::|=.)/.test(token)&&!lineStart.has(token.toLowerCase().replace(/[.,!?;:]+$/,''));}
const markerContinuation=new RegExp(String.raw`<redacted>${wrapMark}?([)\]>"'\x60*]*)((?:[ \t]*\\| *))(\r?\n${quoteMarks})([A-Za-z0-9+/=_%.~&?#-]+)(?=[ \t]*(?:\r?\n|$)|[\s"'\x60)\]>,;])`,'g');
export function omitContinuations(text,removed){
 text=text.replace(taggedContinuation,(match,hardBreak='',lineBreak,token)=>continues(token)?`<redacted>${hardBreak}${lineBreak}${removed(token)}`:match);
 for(let line=0;line<3;line++){
  const next=text.replace(markerContinuation,(match,closer,trail,lineBreak,token)=>keyShaped(token)?`<redacted>${closer}${trail}${lineBreak}${removed(token)}`:match);
  if(next===text)break;text=next;
 }
 return text.replaceAll(wrapMark,'');
}
export function hasContinuation(text){
 for(const m of text.matchAll(markerContinuation))if(keyShaped(m[4]))return true;
 return false;
}
