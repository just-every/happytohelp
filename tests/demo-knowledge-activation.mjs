import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openIdentityDb, seedWorkspace } from './helpers/identity-db.mjs';
import { readDemoReturn, rememberDemoReturn, returnWorkspace, realWorkspaces } from '../src/ui/native/demo/return-workspace.js';
const { ensureDemoInboxAi } = await import('../src/modules/management/demo-inbox-ai.ts');
const { ensureDemoInboxArticles } = await import('../src/modules/management/demo-inbox-articles.ts');
const { routes } = await import('../src/modules/knowledge/routes.ts');

// Storage fixtures are test-only; persisted navigation context never grants access.
const values = new Map(), storage = {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const saved = rememberDemoReturn(storage,'owner','demo','real');
assert.deepEqual(readDemoReturn(storage,'owner','demo'), saved);
assert.equal(readDemoReturn(storage,'other','demo'), null);
assert.equal(readDemoReturn(storage,'owner','another-demo'), null);
assert.equal(returnWorkspace({currentAgent:{id:'other'},projects:{real:{id:'real'}}},saved),null);
assert.equal(returnWorkspace({currentAgent:{id:'owner'},projects:{}},saved),null);
assert.equal(returnWorkspace({currentAgent:{id:'owner'},projects:{real:{id:'real',is_demo:true}}},saved),null);
assert.deepEqual(realWorkspaces({projects:{b:{id:'b',name:'B'},a:{id:'a',name:'A'},demo:{id:'demo',name:'Demo',is_demo:true}}}).map(p=>p.id),['a','b']);

const runtime = await openIdentityDb();
try {
  const {DB,env} = runtime;
  for (const file of ['0050_knowledge.sql','0051_knowledge_authoring.sql','020_ai_support.sql']) {
    const source = (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).replace(/^\s*--[^\n]*$/gm,'');
    for (const [,sql] of source.matchAll(/\s*(CREATE TRIGGER[\s\S]*?END;|[^;]+;)/g)) await DB.prepare(sql).run();
  }
  const seed = async key => {
    const workspace = await seedWorkspace(DB,key);
    await DB.prepare('INSERT INTO project_settings VALUES(?,?,?)').bind(workspace.projectId,JSON.stringify({is_demo:true}),1).run();
    return workspace;
  };
  const articles = async projectId => (await DB.prepare('SELECT * FROM knowledge_articles WHERE project_id=? ORDER BY id').bind(projectId).all()).results;
  const settings = async projectId => JSON.parse((await DB.prepare('SELECT settings_json FROM project_settings WHERE project_id=?').bind(projectId).first()).settings_json);
  const fresh = await seed('fresh');
  await Promise.all([ensureDemoInboxAi(env,fresh.projectId),ensureDemoInboxAi(env,fresh.projectId)]);
  const original = await articles(fresh.projectId);
  assert.equal(original.length,3);
  for (const article of original) {
    assert.equal(article.status,'published');
    assert.match(article.content,/Fictional Northstar Outfitters/);
    const publicResponse=await routes.request(`https://example.test/public/${fresh.projectId}/articles/${article.slug}`,{},env);
    assert.equal(publicResponse.status,200);
    assert.equal((await publicResponse.json()).content,article.content);
  }
  assert.equal((await settings(fresh.projectId)).demo_faq_article_sources.length,3);
  await ensureDemoInboxAi(env,fresh.projectId);
  assert.deepEqual(await articles(fresh.projectId),original,'repeat preserves source identities and timestamps');
  await DB.batch([
    DB.prepare("UPDATE knowledge_articles SET title='Owner edit',content='Owner text',status='draft' WHERE id=?").bind(original[0].id),
    DB.prepare('DELETE FROM knowledge_articles WHERE id=?').bind(original[1].id),
  ]);
  const changed = await articles(fresh.projectId);
  await ensureDemoInboxAi(env,fresh.projectId);
  assert.deepEqual(await articles(fresh.projectId),changed,'owner draft, edits and deletion survive reuse');
  assert.equal((await routes.request(`https://example.test/public/${fresh.projectId}/articles/${original[0].slug}`,{},env)).status,404);

  // Reconstruct a previous-release demo: no article seed marker or articles.
  const legacy = await seed('legacy');
  await ensureDemoInboxAi(env,legacy.projectId);
  await DB.batch([
    DB.prepare('DELETE FROM knowledge_articles WHERE project_id=?').bind(legacy.projectId),
    DB.prepare("UPDATE project_settings SET settings_json=json_remove(settings_json,'$.demo_faq_article_seed_version','$.demo_faq_article_sources') WHERE project_id=?").bind(legacy.projectId),
    DB.prepare("UPDATE knowledge_documents SET content='Owner retained FAQ edit' WHERE id=?").bind(`${legacy.projectId}-faq-gear`),
    DB.prepare('DELETE FROM knowledge_documents WHERE id=?').bind(`${legacy.projectId}-faq-shipping`),
  ]);
  await ensureDemoInboxAi(env,legacy.projectId);
  const upgraded = await articles(legacy.projectId);
  assert.equal(upgraded.length,2,'deleted FAQ is not reconstructed from hardcoded copy');
  assert.equal(upgraded.find(a=>a.id===`${legacy.projectId}-faq-gear-article`).content,'Owner retained FAQ edit');
  assert.equal((await settings(legacy.projectId)).demo_faq_article_sources.length,2);

  const deleted = await seed('deleted');
  await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.demo_ai_seed_version',1) WHERE project_id=?").bind(deleted.projectId).run();
  await ensureDemoInboxAi(env,deleted.projectId);
  assert.deepEqual(await articles(deleted.projectId),[],'an intentionally missing legacy dataset stays missing');
  const normal = await seedWorkspace(DB,'normal');
  await ensureDemoInboxAi(env,normal.projectId);
  assert.deepEqual(await articles(normal.projectId),[],'never seeds a real workspace');
  await DB.prepare("UPDATE project_settings SET settings_json=json_set(settings_json,'$.deleted_at',1) WHERE project_id=?").bind(fresh.projectId).run();
  assert.equal((await routes.request(`https://example.test/public/${fresh.projectId}/articles`,{},env)).status,404);
  await ensureDemoInboxArticles(env,fresh.projectId);
  assert.deepEqual(await articles(fresh.projectId),changed,'deleted demo history stays untouched');
  assert.equal((await DB.prepare('SELECT count(*) n FROM ai_generations').first()).n,0);
  console.log('Demo knowledge activation passed: scoped return context; concurrent fresh publication; public content; legacy edits/deletions; draft/deleted article preservation; real/deleted tenant denial; zero generations.');
} finally { await runtime.dispose(); }
