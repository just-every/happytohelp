import { Hono } from 'hono'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AppEnv,Env } from '../../platform/env'
import { requireProject } from '../../platform/auth'
import { escapeHtml as e } from './html'
import { categoryTree } from './category-tree'
import { missingArticlePage,missingHelpCenterPage } from './not-found'
import { shell } from './shell'
import {publicAppearance} from '../widget/appearance.js'
const articleComponents: React.ComponentProps<typeof Markdown>['components'] = {
 pre: ({children}) => <pre tabIndex={0} role="region" aria-label="Code block">{children}</pre>,
 table: ({children}) => <div className="help-center-table-scroll" tabIndex={0} role="region" aria-label="Article table"><table>{children}</table></div>,
}
export const reserved=new Set(['api','health','setup','login','logout','projects','conversations','contacts','settings','dashboard','marketing','features','resources','company','pricing','waitlist','demo','help','docs','site-assets','widget.js'])
export async function resolvePublicProject(env:Env,key:string,includeDeleted=false){const project=await env.DB.prepare('SELECT p.id,p.name,(SELECT settings_json FROM project_settings s WHERE s.project_id=p.id) settings_json FROM projects p LEFT JOIN public_project_aliases a ON a.project_id=p.id WHERE (p.id=? OR a.slug=?) AND (?=1 OR NOT EXISTS(SELECT 1 FROM project_settings s WHERE s.project_id=p.id AND json_extract(s.settings_json,\'$.deleted_at\') IS NOT NULL)) LIMIT 1').bind(key,key,includeDeleted?1:0).first<{id:string,name:string,settings_json:string}>();if(!project)return null;return {id:project.id,name:project.name,brand:publicAppearance(JSON.parse(project.settings_json||'{}'),project.name)}}
export const helpCenterRoutes=new Hono<AppEnv>()
helpCenterRoutes.put('/api/public-site/projects/:projectId/alias',async c=>{const actor=await requireProject(c,c.req.param('projectId'),true);if(!['owner','admin'].includes(actor.role))return c.json({error:'Project administration required'},403);const b=await c.req.json(),slug=String(b.slug||'').toLowerCase();if(!/^[a-z0-9][a-z0-9-]{1,99}$/.test(slug)||reserved.has(slug))return c.json({error:'Invalid or reserved public slug'},422);if(await c.env.DB.prepare('SELECT id FROM projects WHERE id=? AND id<>?').bind(slug,c.req.param('projectId')).first())return c.json({error:'Slug already in use'},409);const result=await c.env.DB.prepare('INSERT INTO public_project_aliases(slug,project_id) VALUES(?,?) ON CONFLICT(slug) DO UPDATE SET project_id=excluded.project_id WHERE public_project_aliases.project_id=excluded.project_id').bind(slug,c.req.param('projectId')).run();return result.meta.changes?c.json({slug}):c.json({error:'Slug already in use'},409)})
async function render(c:any){const key=c.req.param('project'),project=await resolvePublicProject(c.env,key);if(!project)return c.html(missingHelpCenterPage(),404);const tail=c.req.param('article');const base=c.req.path.startsWith('/help/')?`/help/${encodeURIComponent(key)}`:`/${encodeURIComponent(key)}`;let content='';const keyword=String(c.req.query('keyword')||c.req.query('q')||'').trim().slice(0,200)
 if(tail==='search'){
  if(!keyword)content=`<p>What information would you like to find in the ${e(project.name)} Help Center?</p><p>Please enter your search query above.</p>`
  else{const page=Math.max(1,Math.min(100000,Number.parseInt(c.req.query('page')||'1',10)||1)),pattern=`%${keyword}%`,count=await c.env.DB.prepare("SELECT COUNT(*) total FROM knowledge_articles WHERE project_id=? AND status='published' AND (title LIKE ? OR summary LIKE ? OR content LIKE ?)").bind(project.id,pattern,pattern,pattern).first();const rows=await c.env.DB.prepare("SELECT title,slug,summary FROM knowledge_articles WHERE project_id=? AND status='published' AND (title LIKE ? OR summary LIKE ? OR content LIKE ?) ORDER BY position,title LIMIT 15 OFFSET ?").bind(project.id,pattern,pattern,pattern,(page-1)*15).all();content=`<h1>Search results</h1><p>${count.total} results found</p>`+(count.total===0?`<p class="help-center-notice">Try a shorter phrase or different words, or <a href="${base}">browse all articles</a>.</p>`:'')+rows.results.map((a:any)=>`<h4><a href="${base}/${encodeURIComponent(a.slug)}">${e(a.title)}</a></h4><p>${e(a.summary)}</p>`).join('');content+=`<nav aria-label="Search pages">${page>1?`<a href="${base}/search?keyword=${encodeURIComponent(keyword)}&amp;page=${page-1}">Previous</a>`:''} ${count.total>page*15?`<a href="${base}/search?keyword=${encodeURIComponent(keyword)}&amp;page=${page+1}">Next</a>`:''}</nav>`}
 }else if(tail){const article=await c.env.DB.prepare("SELECT title,content FROM knowledge_articles WHERE project_id=? AND slug=? AND status='published'").bind(project.id,tail).first();if(!article)return c.html(missingArticlePage(project,base),404);content=`<h1>${e(article.title)}</h1>`+renderToStaticMarkup(<Markdown remarkPlugins={[remarkGfm]} components={articleComponents}>{String(article.content)}</Markdown>)}
 else{const [categories,articles]=await Promise.all([c.env.DB.prepare('SELECT id,name,summary,parent_id FROM knowledge_categories WHERE project_id=? AND is_published=1 ORDER BY position,name').bind(project.id).all(),c.env.DB.prepare("SELECT id,title,slug,summary,category_id,(SELECT json_group_array(category_id) FROM knowledge_article_categories WHERE article_id=knowledge_articles.id) category_ids FROM knowledge_articles WHERE project_id=? AND status='published' ORDER BY position,title").bind(project.id).all()]);content=categoryTree(categories.results as any,articles.results as any,base)||'<h1>How can we help?</h1><p class="help-center-notice">There are no published articles yet. Please contact the support team through the website chat.</p>'}
 return c.html(shell(project,base,content,{keyword,greeting:!tail}))
}
helpCenterRoutes.get('/help/:project',render)
helpCenterRoutes.get('/help/:project/:article',render)
helpCenterRoutes.get('/:project',render)
helpCenterRoutes.get('/:project/:article',render)
