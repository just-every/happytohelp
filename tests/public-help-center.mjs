import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL)for(const ext of ['.ts','.tsx']){const u=new URL(s+ext,c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)},load(url,c,n){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return n(url,c)}})
const {getPlatformProxy}=await import('wrangler'),{helpCenterRoutes}=await import('../src/modules/public-site/help-center.tsx'),{publicSiteRoutes}=await import('../src/modules/public-site/index.ts'),proxy=await getPlatformProxy({persist:false})
try{
 const db=proxy.env.DB
 for(const file of ['0001_identity.sql','0050_knowledge.sql','0051_knowledge_authoring.sql','0070_management.sql','0095_public_site.sql'])for(const sql of readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run()
 for(const project of ['alpha','beta'])await db.prepare('INSERT INTO projects VALUES(?,?,?,?,?)').bind(project,project+' company',project+'key','https://example.invalid',1).run()
 await db.prepare("INSERT INTO public_project_aliases VALUES('legacy-slug','alpha')").run()
 for(const [id,project,status,content]of [['visible','alpha','published','# Hello\n\n**Knowledge** <script>alert(1)</script>'],['draft','alpha','draft','Secret draft'],['foreign','beta','published','Other project']])await db.prepare('INSERT INTO knowledge_articles(id,project_id,slug,title,content,status,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,project,id,id,content,status,1).run()
 const get=path=>helpCenterRoutes.request('http://localhost'+path,{},proxy.env)
 for(const path of ['/alpha','/legacy-slug','/help/alpha','/alpha/search','/alpha/search?keyword=Knowledge','/help/legacy-slug/visible'])assert.equal((await get(path)).status,200,path)
 const article=await(await get('/legacy-slug/visible')).text();assert.match(article,/<strong>Knowledge<\/strong>/);assert.doesNotMatch(article,/<script>alert/)
 assert.equal((await get('/alpha/draft')).status,404);assert.equal((await get('/alpha/foreign')).status,404);assert.equal((await get('/missing')).status,404)
 const search=await(await get('/alpha/search?keyword=Secret')).text();assert.match(search,/0 results found/);assert.doesNotMatch(search,/Secret draft/)
 assert.equal((await helpCenterRoutes.request('http://localhost/api/public-site/projects/alpha/alias',{method:'PUT',body:JSON.stringify({slug:'new-slug'}),headers:{'content-type':'application/json'}},proxy.env)).status,401)
 // 404s render inside the Help Center frame as HTML; an unpublished draft is byte-identical to an article that never existed.
 const missing=await get('/alpha/never-written'),draft=await get('/alpha/draft'),foreign=await get('/alpha/foreign')
 for(const response of [missing,draft,foreign]){assert.equal(response.status,404);assert.match(response.headers.get('content-type')||'',/^text\/html/)}
 const missingHtml=await missing.text();assert.equal(await draft.text(),missingHtml);assert.equal(await foreign.text(),missingHtml)
 assert.match(missingHtml,/<title>Article not found · alpha company Help Center<\/title>/);assert.match(missingHtml,/data-help-center-nav/);assert.match(missingHtml,/type="search"/);assert.match(missingHtml,/href="\/alpha"/);assert.match(missingHtml,/name="robots" content="noindex"/);assert.doesNotMatch(missingHtml,/Secret draft|draft|never-written/)
 const unknown=await get('/help/no-such-project');assert.equal(unknown.status,404);assert.match(unknown.headers.get('content-type')||'',/^text\/html/)
 const unknownHtml=await unknown.text();assert.match(unknownHtml,/data-help-center-nav/);assert.match(unknownHtml,/Help Center not found · HappyToHelp/);assert.doesNotMatch(unknownHtml,/type="search"|no-such-project/)
 const site=path=>publicSiteRoutes.request('http://localhost'+path,{},proxy.env)
 const deep=await site('/help/a/b/c');assert.equal(deep.status,404);assert.match(deep.headers.get('content-type')||'',/^text\/html/);assert.equal(await deep.text(),unknownHtml)
 const api=await site('/api/public-site/nothing');assert.equal(api.status,404);assert.match(api.headers.get('content-type')||'',/^text\/plain/)
 await db.prepare("INSERT INTO project_settings VALUES('alpha',json_object('deleted_at',123),123)").run();assert.equal((await get('/legacy-slug/visible')).status,404);assert.equal((await get('/help/alpha')).status,404)
 console.log('Real D1 public helpcenter: original and /help aliases, Markdown, keyword search, draft/cross-project denial, alias auth, HTML Help Center 404s without draft disclosure passed')
}finally{await proxy.dispose()}
