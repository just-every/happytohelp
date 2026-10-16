import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)}});
const { routes } = await import('../src/modules/customer-context/routes.ts');
const { hashToken } = await import('../src/platform/auth.ts');
const { getPlatformProxy } = await import('wrangler');
const proxy = await getPlatformProxy({persist:false});
try {
 const env = proxy.env;
 for (const name of ['0001_identity.sql','0002_conversations.sql','123_operator_notifications.sql','0005_widget_identity.sql','0070_management.sql','0060_customer_context.sql']) {
  const source=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
  for(const sql of source.split(';').filter(sql=>sql.trim()))await env.DB.prepare(sql).run();
 }
 await env.DB.batch([
  env.DB.prepare("INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('p','Owner project','w','https://widget.example',1),('q','Foreign project','x','https://foreign.example',1)"),
  env.DB.prepare("INSERT INTO users VALUES('u','operator@example.test','Operator',1)"),
  env.DB.prepare("INSERT INTO memberships VALUES('p','u','operator')"),
  env.DB.prepare("INSERT INTO sessions VALUES(?,'u','p','operator',NULL,?,NULL)").bind(await hashToken('test-only'),Date.now()+600000),
 ]);
 for(let index=0;index<55;index++)await env.DB.prepare('INSERT INTO context_insights VALUES(?,?,?,?,?,?,?,?,NULL)').bind(`i${String(index).padStart(3,'0')}`,'p','subject','support',`Insight ${index}`,'[]','[]',100).run();
 await env.DB.prepare("INSERT INTO context_insights VALUES('foreign','q','other','support','Private foreign insight','[]','[]',100,NULL)").run();
 const request = (path,auth=true)=>routes.request('https://app.example'+path,{headers:auth?{Authorization:'Bearer test-only'}:{}},env);
 assert.equal((await request('/p/insights',false)).status,401);
 assert.equal((await request('/q/insights')).status,403);
 const first = await (await request('/p/insights')).json();
 assert.equal(first.data.length,50);
 assert.ok(first.nextCursor);
 const last = await (await request('/p/insights?cursor='+encodeURIComponent(first.nextCursor))).json();
 assert.equal(last.data.length,5);
 assert.equal(last.nextCursor,null);
 assert.equal(new Set([...first.data,...last.data].map(row=>row.id)).size,55);
 assert.equal(JSON.stringify(first).includes('Private foreign insight'),false);
 assert.equal((await request('/p/insights?cursor=invalid')).status,400);
 console.log('Project insight inventory: authenticated tenant isolation and collision-safe pagination passed.');
} finally { await proxy.dispose(); }
