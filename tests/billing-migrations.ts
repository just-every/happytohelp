/** Preserve trigger bodies while applying original SQLite migration statements. */
export function billingStatements(source:string){
 const result:string[]=[];let pending=''
 for(const part of source.split(';')){
  pending+=part
  if(/^\s*CREATE TRIGGER\b/i.test(pending)&&! /\bEND\s*$/i.test(pending)){pending+=';';continue}
  if(pending.trim())result.push(pending)
  pending=''
 }
 if(pending.trim())throw new Error('Unterminated billing fixture migration')
 return result
}
