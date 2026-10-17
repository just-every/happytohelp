import {escapeHtml as e} from './html'
/** Page templates are text. Only the content slot contains our own rendered HTML. */
export function helpTemplate(template:string|undefined,content:string,title:string,summary=''){
 if(!template)return content
 const fill=(value:string)=>e(value).replaceAll('{{title}}',e(title)).replaceAll('{{summary}}',e(summary)).replaceAll('\n','<br>')
 const slot=template.indexOf('{{content}}')
 if(slot<0)return `<div class="help-center-template">${fill(template)}</div>${content}`
 return `<div class="help-center-template">${fill(template.slice(0,slot))}</div>${content}<div class="help-center-template">${fill(template.slice(slot+11).replaceAll('{{content}}',''))}</div>`
}
