import {registerHooks} from 'node:module'
import {existsSync,readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL)for(const ext of ['.ts','.tsx']){const u=new URL(s+ext,c.parentURL);if(existsSync(u))return n(u.href,c)}return n(s,c)},load(url,c,n){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext}}).outputText,shortCircuit:true};return n(url,c)}})
const {getPlatformProxy}=await import('wrangler'),{helpCenterRoutes,reserved}=await import('../src/modules/public-site/help-center.tsx'),{publicSiteRoutes,isPublicSitePath}=await import('../src/modules/public-site/index.ts'),proxy=await getPlatformProxy({persist:false})
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
 // Summary-only matches must use the same publication/project fences and page boundaries as title/body matches.
 const summaryArticles=Array.from({length:18},(_,i)=>({slug:`guide-${i}`,title:`Guide ${String(i).padStart(2,'0')}`}))
 for(const entry of summaryArticles)await db.prepare("INSERT INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at) VALUES(?,'alpha',?,?,?,'violet lantern','published',1)").bind(entry.slug,entry.slug,entry.title,'Instructions for your account.').run()
 await db.prepare("UPDATE knowledge_articles SET summary='violet lantern' WHERE id IN ('draft','foreign')").run()
 const summaryPage=await(await get('/legacy-slug/search?keyword=violet%20lantern')).text()
 const nextHref=summaryPage.match(/<a href="([^"]+)">Next<\/a>/)?.[1].replaceAll('&amp;','&')
 assert.ok(nextHref,'summary matches offer the next page')
 const nextPage=await(await get(nextHref)).text()
 const articleLinks=html=>[...html.matchAll(/<h4><a href="\/legacy-slug\/([^"]+)">/g)].map(match=>match[1])
 const firstMatches=articleLinks(summaryPage),laterMatches=articleLinks(nextPage)
 assert.ok(firstMatches.length&&laterMatches.length,'both pages contain results')
 assert.deepEqual([...firstMatches,...laterMatches].sort(),summaryArticles.map(article=>article.slug).sort(),'every owned published summary match appears once across pages')
 assert.doesNotMatch(nextPage,/>Next<\/a>/)
 assert.match(nextPage,/>Previous<\/a>/)
 const emptyPage=await(await get('/legacy-slug/search?keyword=violet%20lantern&page=100')).text();assert.deepEqual(articleLinks(emptyPage),[])
 assert.equal((await helpCenterRoutes.request('http://localhost/api/public-site/projects/alpha/alias',{method:'PUT',body:JSON.stringify({slug:'new-slug'}),headers:{'content-type':'application/json'}},proxy.env)).status,401)
 // 404s render inside the Help Center frame as HTML; an unpublished draft is byte-identical to an article that never existed.
 const missing=await get('/alpha/never-written'),draft=await get('/alpha/draft'),foreign=await get('/alpha/foreign')
 for(const response of [missing,draft,foreign]){assert.equal(response.status,404);assert.match(response.headers.get('content-type')||'',/^text\/html/)}
 const missingHtml=await missing.text();assert.equal(await draft.text(),missingHtml);assert.equal(await foreign.text(),missingHtml)
 assert.match(missingHtml,/<title>Article not found · alpha company Help Center<\/title>/);assert.match(missingHtml,/data-help-center-nav/);assert.match(missingHtml,/type="search"/);assert.match(missingHtml,/href="\/alpha"/);assert.match(missingHtml,/name="robots" content="noindex"/);assert.doesNotMatch(missingHtml,/Secret draft|draft|never-written/)
 const unknown=await get('/help/no-such-project');assert.equal(unknown.status,404);assert.match(unknown.headers.get('content-type')||'',/^text\/html/)
 const unknownHtml=await unknown.text();assert.match(unknownHtml,/data-help-center-nav/);assert.match(unknownHtml,/Help Center not found · HappyToHelp/);assert.doesNotMatch(unknownHtml,/type="search"|no-such-project/)
 // The no-project page is HappyToHelp's: its mark and drawn wordmark from their one geometry, and the application's tab icons.
 // A project's pages carry none of HappyToHelp's brand.
 const {markSvg}=await import('../src/ui/homepage/brand-mark.ts'),{wordSvg}=await import('../src/ui/homepage/brand-word.ts'),{platformIcons}=await import('../src/modules/public-site/platform-brand.ts')
 assert.ok(unknownHtml.includes(`<a class="help-center-brand" href="/"><span class="help-center-lockup" aria-hidden="true">${markSvg().trim()}${wordSvg()}</span><span><strong class="help-center-sr">HappyToHelp</strong> Help Center</span></a>`),'the no-project page draws the HappyToHelp lockup')
 assert.equal([...unknownHtml.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g)].map(m=>m[0]).join(''),platformIcons,'the no-project page has the application tab icons')
 assert.equal([...platformIcons.matchAll(/<link /g)].length,3)
 for(const html of [missingHtml,article,search,await(await get('/alpha')).text()]){assert.ok(!html.includes(markSvg().trim())&&!html.includes(wordSvg())&&!html.includes('help-center-lockup'),'project pages carry no HappyToHelp lockup');assert.doesNotMatch(html,/happytohelp-favicon|apple-touch-icon|rel="icon"/,'project pages carry no HappyToHelp tab icons')}
 const site=path=>publicSiteRoutes.request('http://localhost'+path,{},proxy.env)
 const deep=await site('/help/a/b/c');assert.equal(deep.status,404);assert.match(deep.headers.get('content-type')||'',/^text\/html/);assert.equal(await deep.text(),unknownHtml)
 const api=await site('/api/public-site/nothing');assert.equal(api.status,404);assert.match(api.headers.get('content-type')||'',/^text\/plain/)
 // /docs is the site's documentation: no alias can shadow it, and deciding so needs no database lookup. An alias named docs from
 // before the reservation stays reachable at /help/docs.
 assert.ok(reserved.has('docs'))
 await db.prepare("INSERT INTO public_project_aliases VALUES('docs','alpha')").run()
 let lookups=0;const counted={...proxy.env,DB:{prepare:(...args)=>{lookups++;return db.prepare(...args)}}}
 for(const path of ['/docs','/docs/install'])assert.equal(await isPublicSitePath(path,counted),false,path)
 assert.equal(lookups,0,'a docs path is decided without a D1 lookup')
 assert.equal(await isPublicSitePath('/legacy-slug',counted),true);assert.equal(lookups,1,'other one-segment paths still look up a project')
 assert.equal((await get('/help/docs')).status,200,'/help/docs')
 await db.prepare("INSERT INTO project_settings VALUES('alpha',json_object('deleted_at',123),123)").run();assert.equal((await get('/legacy-slug/visible')).status,404);assert.equal((await get('/help/alpha')).status,404);assert.equal((await get('/legacy-slug/search?keyword=violet%20lantern')).status,404)
 console.log('Real D1 public helpcenter: original and /help aliases, reserved /docs without a lookup, Markdown, keyword search, draft/cross-project denial, alias auth, HTML Help Center 404s without draft disclosure passed')
}finally{await proxy.dispose()}
