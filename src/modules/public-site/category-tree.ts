import { escapeHtml as e } from './html'
interface Category { id:string;name:string;summary:string;parent_id:string|null }
interface Article { title:string;slug:string;category_id:string|null;category_ids:string }
/** Retains the original recursive category tree and many-category article links. */
export function categoryTree(categories:Category[],articles:Article[],base:string){
 const visited=new Set<string>()
 function render(category:Category,level:number):string{
  if(visited.has(category.id))return ''
  visited.add(category.id)
  const heading=level?`<p><strong>${e(category.name)}</strong></p>`:`<h1>${e(category.name)}</h1>`
  const children=categories.filter(child=>child.parent_id===category.id).map(child=>`<li>${render(child,level+1)}</li>`).join('')
  const links=articles.filter(article=>article.category_id===category.id||JSON.parse(article.category_ids||'[]').includes(category.id)).map(article=>`<li><a href="${base}/${encodeURIComponent(article.slug)}">${e(article.title)}</a></li>`).join('')
  return heading+(category.summary?`<p>${e(category.summary).replaceAll('\n','<br>')}</p>`:'')+(children?`<ul>${children}</ul>`:'')+(links?`<ul>${links}</ul>`:'')
 }
 let html=categories.filter(category=>!category.parent_id||!categories.some(parent=>parent.id===category.parent_id)).map(category=>render(category,0)).join('')
 // Corrupt legacy cycles must not recurse forever or silently erase the corpus.
 for(const category of categories)if(!visited.has(category.id))html+=render(category,0)
 return html+articles.filter(article=>!article.category_id&&!JSON.parse(article.category_ids||'[]').length).map(article=>`<h4><a href="${base}/${encodeURIComponent(article.slug)}">${e(article.title)}</a></h4>`).join('')
}
