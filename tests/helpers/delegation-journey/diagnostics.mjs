import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Rer error events carry diagnostics already redacted at Base's command
// boundary. Retain those on failure without exporting setup files, cookies,
// the outbox or browser storage. Strip generated capabilities defensively.
export function safeDiagnostic(value,secrets=[]){
 let text=String(value);
 for(const secret of secrets.filter(Boolean))text=text.replaceAll(secret,'[REDACTED]');
 return text.replace(/(https?:\/\/[^\s"'<>#]+)#[^\s"'<>]+/g,'$1#[REDACTED]')
  .replace(/(Bearer\s+)[^\s"'<>]+/gi,'$1[REDACTED]')
  .replace(/\b[A-Za-z0-9_-]{40,}\b/g,'[REDACTED]');
}
export async function failureDiagnostics({evidence,stage,error,server,scratch,secrets}){
 const errors=(server?.events()||[]).filter(event=>event.event==='error').map(event=>({event:event.event,code:event.code,message:safeDiagnostic(event.message,secrets)}));
 await writeFile(join(evidence,'browser-failure.json'),JSON.stringify({stage,error:{name:error.name,message:safeDiagnostic(error.message,secrets),stack:safeDiagnostic(error.stack,secrets)},rerErrors:errors,retainedPrivateScratch:scratch},null,2),{mode:0o600});
}
