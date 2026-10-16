// @ts-ignore Pure-JavaScript parser, shared by both MIME gateways.
import {convert} from 'html-to-text'

export function plainEmail(text:string,html=''){
 return text|| (html?convert(html,{wordwrap:false,selectors:[{selector:'script',format:'skip'},{selector:'style',format:'skip'}]}):'')
}

/** Retain the original separately. Only conventional trailing quote/signature
 * boundaries are removed; a customer mentioning "wrote" in a sentence is text. */
export function visibleEmailReply(raw:string){
 const lines=raw.replace(/\r\n?/g,'\n').split('\n'),visible:string[]=[]
 for(let index=0;index<lines.length;index++){
  const line=lines[index]
  if(/^\s*(?:On\s+.{3,500}\s+wrote:|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b.{3,500}\bwrote:)\s*$/i.test(line))break
  if(/^\s*-{2,}\s*(?:Original Message|Forwarded message)\s*-{2,}\s*$/i.test(line))break
  if(/^\s*From:\s+\S/i.test(line)&&lines.slice(index+1,index+6).some(next=>/^\s*(?:Sent|Date|To|Subject):/i.test(next)))break
  if(/^\s*--\s*$/.test(line)||/^\s*Sent from my (?:iPhone|iPad|Android|Galaxy)\b/i.test(line))break
  // Wrapped Gmail/Apple quote headers, with a date on the next line.
  if(/^\s*On\s+\S/i.test(line)&&!line.includes('wrote:')){
   const end=lines.slice(index,index+4).join(' ')
   if(/^\s*On\s+.{3,1000}\bwrote:\s*$/i.test(end))break
  }
  if(/^\s*>/.test(line))continue
  visible.push(line)
 }
 return visible.join('\n').trim()
}
