// A named credential assignment is different from an environment-presence
// diagnostic or a reference to the variable holding it. Values still pass all
// provider, opaque-payload and hash checks in secrets.mjs.
const credentialName=/(?:key|secret|token|password|salt|credential|encrypt(?:ion)?)$/i;
function symbolic(value){
  return /^(?:\$\{?[A-Z][A-Z0-9_]*\}?|!?\!?process\.env\.[A-Z][A-Z0-9_]*)$/.test(value)
    || /^(?:\.{3}|\*{3,}|<redacted>|\[redacted\]|REDACTED|<YOUR[_A-Z0-9 -]+>|(?:YOUR|DEIN)[_-][A-Z0-9_-]*(?:KEY|TOKEN|PASSWORD|SECRET)[_A-Z0-9-]*)$/i.test(value);
}
export function hasCredentialAssignment(text){
  const assignments=/\b([A-Za-z][\w-]*)["']?\s*([:=])\s*(?:(["'])([^\r\n]*?)\3|([^\s"',;}]+))/g;
  for(const match of text.matchAll(assignments)){
    const [,name,operator,quote,quoted,plain]=match;
    if(!credentialName.test(name)||/Error$/.test(name)||/^Idempotency-Key$/i.test(name)||name.toLowerCase()==='key'&&/\bidempotency\s+$/i.test(text.slice(0,match.index)))continue;
    const value=(quote?quoted:plain).replace(/^`|`$/g,'');
    if(!value||symbolic(value)||value==='sk-...')continue;
    const tail=text.slice(match.index+match[0].length);
    // Code references and documentation placeholders carry no credential value.
    if(!quote&&operator==='='&&name==='secret'&&value==='new'&&/^ TextEncoder\(\)\.encode\(process\.env\.[A-Z_][A-Z0-9_]*\)/.test(tail))continue;
    if(!quote&&operator==='='&&name==='token'&&value==='request.cookies.get('&&/^["'][A-Za-z_][A-Za-z0-9_]*["']\)\?\.value/.test(tail))continue;
    if(!quote&&operator===':'&&name==='Key'&&value==='你的'&&/^ (?:API Key|key)\b/.test(tail))continue;
    if(!quote&&operator==='='&&name==='key'&&value==='Codex'&&/^ imagegen\b/.test(tail))continue;
    // A colon with an unquoted literal is a typed presence/state observation.
    // Shell assignments and quoted strings remain credential candidates.
    if(operator===':'&&!quote&&/^(?:true|false|null|undefined|None)$/.test(value))continue;
    return true;
  }
  return false;
}

// These reviewed credential labels occur in diagnostic support transcripts.
// Omit their values, retain the surrounding support text, and record the count.
// Unknown assignments and opaque strings still stop extraction.
const reviewedCredentials=/\b(GPTCODEX_API_KEY|CPACODEX_API_KEY|CODEXMANAGER_API_KEY|CODEXEASY_API_KEY|JWT_SECRET|Credential)(\s*[:=]\s*)(?:(["'])([^\r\n]*?)\3|([^\s"',;}]+))/g;
export function omitSupportCredentials(table,column,value){
  if(table!=='messages'||column!=='content'||typeof value!=='string')return {value,omitted:0};
  let omitted=0;
  value=value.replace(reviewedCredentials,(_match,name,separator,quote,quoted,plain)=>{
    if(symbolic(quote?quoted:plain))return _match;
    omitted++;
    return name+separator+(quote||'')+'<redacted>'+(quote||'');
  });
  return {value,omitted};
}
