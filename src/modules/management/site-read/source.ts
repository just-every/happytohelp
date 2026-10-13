import type {Env} from '../../../platform/env'
import {activeSourceProjectSql} from '../../knowledge/public-sources'
import type {SitePage} from './parse'
import {runningGuard} from './state'

async function fingerprintOf(pages: SitePage[]): Promise<string> {
 const bytes = new TextEncoder().encode(pages.map(page => `${page.url}\n${page.title}\n${page.content}`).join('\n\u0000\n'))
 return `site-read:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Write the pages a finished read found as one private, published knowledge source: a dataset, its one version and a
 * document per page, in a single atomic batch. It is the shape the demo workspace seeds, so the assistant's knowledge
 * search reads it as it reads any dataset, with no crawler, embedding provider, queue or file store involved, and no
 * article of any status is written. Every statement checks that this read still owns the `running` claim and that the
 * workspace is live, so a read the scheduler gave up on, or a deleted workspace, gets nothing. The ids are fixed per
 * workspace, so a repeat of the same read is harmless. Returns how many pages were written.
 */
export async function writeSiteSource(env: Env, projectId: string, site: {name: string | null; origin: string; pages: SitePage[]}): Promise<number> {
 if (!site.pages.length) return 0
 const now = Date.now(), datasetId = `${projectId}-site`, versionId = `${datasetId}-v1`
 const running = runningGuard(projectId)
 const eligible = `EXISTS(${running.sql}) AND ${activeSourceProjectSql('?')}`
 const guard = [...running.params, projectId]
 const results = await env.DB.batch([
  env.DB.prepare(`INSERT OR IGNORE INTO knowledge_datasets(id,project_id,name,url,status,published_version,refresh_mode,next_refresh_at,last_refreshed_at,created_at) SELECT ?,?,?,?,'ready',?,'manual',NULL,?,? WHERE ${eligible}`)
   .bind(datasetId, projectId, site.name ?? new URL(site.origin).host, site.origin, versionId, now, now, ...guard),
  env.DB.prepare(`INSERT OR IGNORE INTO knowledge_versions(id,dataset_id,fingerprint,created_at,semantic,embedding_model) SELECT ?,?,?,?,0,NULL WHERE ${eligible}`)
   .bind(versionId, datasetId, await fingerprintOf(site.pages), now, ...guard),
  ...site.pages.map((page, index) => env.DB.prepare(`INSERT OR IGNORE INTO knowledge_documents(id,version_id,url,title,content) SELECT ?,?,?,?,? WHERE ${eligible}`)
   .bind(`${datasetId}-${index}`, versionId, page.url, page.title, page.content, ...guard)),
 ])
 if (!results[0].meta.changes) throw new Error('The site source was not written: the read no longer holds its claim, or the source already exists')
 return site.pages.length
}
