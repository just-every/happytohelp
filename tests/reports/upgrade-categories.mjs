import assert from 'node:assert/strict';
import {join} from 'node:path';
import {getPlatformProxy} from 'wrangler';

// Seed before the final upgrade, so the existing all-row comparison also guards
// article content, incarnation, revision and publication version across the DDL.
export async function seedCategoryUpgrade(storage) {
  await storage.inspect({sql:"INSERT INTO projects(id,name,widget_key,allowed_origin,created_at) VALUES('category-peer','Peer','category-peer-widget','https://peer.example.test',1)"});
  await storage.inspect({sql:`INSERT INTO knowledge_categories(id,project_id,parent_id,name,slug) VALUES
    ('category-root','upgrade-project',NULL,'Root','root'),
    ('category-child','upgrade-project','category-root','Child','child'),
    ('category-direct','upgrade-project',NULL,'Direct','direct'),
    ('category-unrelated','upgrade-project',NULL,'Unrelated','unrelated')`});
  await storage.inspect({sql:`INSERT INTO knowledge_articles(id,project_id,category_id,slug,title,content,status,updated_at) VALUES
    ('primary-direct','upgrade-project','category-direct','primary-direct','Direct','Keep direct café','published',1),
    ('primary-child','upgrade-project','category-child','primary-child','Descendant','Keep descendant 日本語','published',1),
    ('additional-direct','upgrade-project',NULL,'additional-direct','Additional direct','Keep direct link','published',1),
    ('additional-child','upgrade-project',NULL,'additional-child','Additional descendant','Keep descendant link','published',1),
    ('unrelated-article','upgrade-project','category-unrelated','unrelated','Unrelated','Keep unrelated','published',1),
    ('peer-article','category-peer',NULL,'peer','Peer','Keep peer','published',1)`});
  await storage.inspect({sql:"INSERT INTO knowledge_article_categories(article_id,category_id) VALUES('additional-direct','category-direct'),('additional-child','category-child')"});
}

export async function assertCategoryUpgrade(directory) {
  // The recovery runtime is stopped. Open its native D1 storage as the sole
  // owner, using the same configuration and persistence as withStorage.
  const proxy=await getPlatformProxy({configPath:join(directory,'storage.wrangler.json'),envFiles:[],remoteBindings:false,persist:{path:join(directory,'.wrangler/state/v3')}});
  try {
    const db=proxy.env.DB,query='SELECT * FROM knowledge_articles ORDER BY id';
    const articles=async()=>(await db.prepare(query).all()).results;
    const before=await articles();
    await db.prepare("INSERT INTO knowledge_categories(id,project_id,name,slug) VALUES('category-new','upgrade-project','New','new')").run();
    assert.deepEqual(await articles(),before,'upgraded category creation preserves every article column');
    await db.prepare("DELETE FROM knowledge_categories WHERE id='category-new'").run();
    assert.deepEqual(await articles(),before,'upgraded unrelated category deletion preserves every article column');

    async function deletion(category,affected,cleanup) {
      const prior=await articles();
      // Observe revisions immediately after DELETE, before FK cleanup's UPDATE
      // triggers can invalidate articles themselves. Native D1 batches defer
      // constraints until commit; every reference is valid when this one ends.
      const result=await db.batch([
        db.prepare('PRAGMA defer_foreign_keys=ON'),
        db.prepare('DELETE FROM knowledge_categories WHERE id=? RETURNING id').bind(category),
        db.prepare(query),
        db.prepare(cleanup),
        db.prepare('PRAGMA defer_foreign_keys=OFF'),
      ]);
      assert.deepEqual(result[1].results,[{id:category}],'the intended category was deleted');
      assert.deepEqual(result[2].results.map(row=>row.id),prior.map(row=>row.id),'deletion preserves every article');
      for(const row of result[2].results) {
        const old=prior.find(article=>article.id===row.id);
        if(affected.includes(row.id)) {
          assert.ok(row.source_revision>old.source_revision,category+' invalidates '+row.id);
          assert.notEqual(row.publication_version,old.publication_version,category+' invalidates publication evidence for '+row.id);
          assert.deepEqual({...row,source_revision:old.source_revision,publication_version:old.publication_version},old,'invalidation preserves other article columns');
        } else assert.deepEqual(row,old,category+' preserves unrelated article '+row.id);
      }
      assert.equal(await db.prepare('SELECT id FROM knowledge_categories WHERE id=?').bind(category).first(),null);
      assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
    }
    await deletion('category-direct',['primary-direct','additional-direct'],"UPDATE knowledge_articles SET category_id=NULL WHERE category_id='category-direct'");
    await deletion('category-root',['primary-child','additional-child'],"UPDATE knowledge_categories SET parent_id=NULL WHERE parent_id='category-root'");
  } finally {await proxy.dispose();}
}
