import { escapeHtml as e } from './html'
import {helpTemplate} from './help-template'
interface Category { id:string;name:string;summary:string;parent_id:string|null }
interface Article { title:string;slug:string;category_id:string|null;category_ids:string|string[] }
/** Retains the original recursive category tree and many-category article links. */
export function categoryTree(categories:Category[],articles:Article[],base:string,suffix='',templates:Record<string,string>={}){
 const visited=new Set<string>()
 function render(category:Category,level:number):string{
  if(visited.has(category.id))return ''
  visited.add(category.id)
  const heading=level?`<p><strong>${e(category.name)}</strong></p>`:`<h1>${e(category.name)}</h1>`
  const children=categories.filter(child=>child.parent_id===category.id).map(child=>`<li>${render(child,level+1)}</li>`).join('')
  const links=articles.filter(article=>article.category_id===category.id||(Array.isArray(article.category_ids)?article.category_ids:JSON.parse(article.category_ids||'[]')).includes(category.id)).map(article=>`<li><a data-help-article="${e(article.slug)}" href="${base}/${encodeURIComponent(article.slug)}${suffix}">${e(article.title)}</a></li>`).join('')
  const content=heading+(category.summary?`<p>${e(category.summary).replaceAll('\n','<br>')}</p>`:'')+(children?`<ul>${children}</ul>`:'')+(links?`<ul>${links}</ul>`:'')
  return helpTemplate(templates[level?'section':'category'],content,category.name,category.summary)
 }
 let html=categories.filter(category=>!category.parent_id||!categories.some(parent=>parent.id===category.parent_id)).map(category=>render(category,0)).join('')
 // Corrupt legacy cycles must not recurse forever or silently erase the corpus.
 for(const category of categories)if(!visited.has(category.id))html+=render(category,0)
 return html+articles.filter(article=>!article.category_id&&!(Array.isArray(article.category_ids)?article.category_ids:JSON.parse(article.category_ids||'[]')).length).map(article=>`<h4><a data-help-article="${e(article.slug)}" href="${base}/${encodeURIComponent(article.slug)}${suffix}">${e(article.title)}</a></h4>`).join('')
}
