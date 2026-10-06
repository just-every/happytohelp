import type { Env } from '../../platform/env'

/** Publish the existing fictional FAQ once, taking the current retained copy.
 * Missing/deleted sources stay missing. Reopening never overwrites edits,
 * republishes drafts or restores deleted articles. The source map records the
 * original dataset relationship for the article-retrieval integration. */
export async function ensureDemoInboxArticles(env: Env, projectId: string) {
  const datasetId = `${projectId}-faq`, now = Date.now()
  const eligible = `EXISTS(SELECT 1 FROM project_settings WHERE project_id=?
    AND json_extract(settings_json,'$.is_demo')=1
    AND json_type(settings_json,'$.deleted_at') IS NULL
    AND json_type(settings_json,'$.demo_faq_article_seed_version') IS NULL)`
  const sources = `FROM knowledge_documents f JOIN knowledge_datasets d ON d.published_version=f.version_id
    WHERE d.id=? AND d.project_id=? AND f.url IN ('h2h://northstar-demo/gear','h2h://northstar-demo/shipping','h2h://northstar-demo/groupkit')`
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO knowledge_articles(id,project_id,slug,title,content,summary,status,updated_at)
      SELECT f.id || '-article',?,'northstar-demo-' || substr(f.url,length('h2h://northstar-demo/')+1),f.title,f.content,
      'Fictional Northstar Outfitters demo FAQ.','published',? ${sources} AND ${eligible}`)
      .bind(projectId,now,datasetId,projectId,projectId),
    env.DB.prepare(`UPDATE project_settings SET settings_json=json_insert(settings_json,
      '$.demo_faq_article_seed_version',1,'$.demo_faq_article_sources',json((SELECT json_group_array(json_object(
        'articleId',f.id || '-article','datasetId',d.id,'versionId',f.version_id,'documentId',f.id))
        ${sources} AND EXISTS(SELECT 1 FROM knowledge_articles a WHERE a.id=f.id || '-article' AND a.project_id=d.project_id AND a.title=f.title AND a.content=f.content)))),updated_at=?
      WHERE project_id=? AND ${eligible}`).bind(datasetId,projectId,now,projectId,projectId),
  ])
}
