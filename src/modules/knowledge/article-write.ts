import {HTTPException} from 'hono/http-exception'
import type {Env} from '../../platform/env'
import type {SqlGuard} from '../../platform/integration-authority'
import {requiredString} from '../../platform/db'
/** Shared dashboard/API publication path. Category links follow the same guarded
 * receipt as the article; current category ownership is rechecked in the batch. */
export async function writeArticle(env:Env,projectId:string,b:any,guard?:SqlGuard,preserveCategories=false){
 const articleId=b.id||crypto.randomUUID(),status=b.status||(b.is_published?'published':'draft')
 if(!['draft','published'].includes(status))throw new HTTPException(400,{message:'Invalid status'})
 const existing=await env.DB.prepare('SELECT project_id FROM knowledge_articles WHERE id=?').bind(articleId).first<{project_id:string}>()
 if(existing&&existing.project_id!==projectId)throw new HTTPException(404,{message:'Not found'})
 const categories=b.categoryIds||b.categories||(b.categoryId?[b.categoryId]:[])
 if(!Array.isArray(categories)||categories.length>100||categories.some((x:any)=>typeof x!=='string')||new Set(categories).size!==categories.length)throw new HTTPException(400,{message:'Invalid categories'})
 for(const category of categories)if(!await env.DB.prepare('SELECT id FROM knowledge_categories WHERE id=? AND project_id=?').bind(category,projectId).first())throw new HTTPException(400,{message:'Category not found'})
 const now=Date.now(),condition=guard?`EXISTS(${guard.sql})`:'1=1'
 const categoryGuard=categories.length?`AND (SELECT count(*) FROM knowledge_categories WHERE project_id=? AND id IN (${categories.map(()=>'?').join(',')}))=?`:''
 const args=[...(guard?.params||[]),...(categories.length?[projectId,...categories,categories.length]:[])]
 // All category operations repeat the same token/category predicate inside this
 // transaction, and are scoped to the article admitted by the first statement.
 const predicate=`${condition} ${categoryGuard}`
 // An API edit without category fields leaves both the primary category and links
 // untouched at commit, including category changes made after its initial read.
 const statements=[env.DB.prepare(`INSERT INTO knowledge_articles(id,project_id,category_id,slug,title,content,summary,status,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${predicate} ON CONFLICT(id) DO UPDATE SET ${preserveCategories?'':'category_id=excluded.category_id,'}slug=excluded.slug,title=excluded.title,content=excluded.content,summary=excluded.summary,status=excluded.status,updated_at=excluded.updated_at WHERE knowledge_articles.project_id=excluded.project_id`).bind(articleId,projectId,categories[0]||null,requiredString(b.slug||`${String(b.title).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${articleId.slice(0,8)}`,'slug',200),requiredString(b.title,'title',500),requiredString(b.content,'content',100000),b.summary||'',status,now,...args)]
 if(!preserveCategories)statements.push(
  env.DB.prepare(`DELETE FROM knowledge_article_categories WHERE article_id=? AND EXISTS(SELECT 1 FROM knowledge_articles WHERE id=? AND project_id=?) AND ${predicate}`).bind(articleId,articleId,projectId,...args),
  ...categories.map((category:string)=>env.DB.prepare(`INSERT INTO knowledge_article_categories(article_id,category_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM knowledge_articles WHERE id=? AND project_id=?) AND ${predicate}`).bind(articleId,category,articleId,projectId,...args)))
 const result=await env.DB.batch(statements);if(!result[0].meta.changes)throw new HTTPException(409,{message:'Article or authority changed'})
 return {id:articleId}
}
