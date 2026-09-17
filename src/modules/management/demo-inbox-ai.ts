import type { Env } from '../../platform/env'

const prompt = `You assist the human support team at Northstar Outfitters, a fictional outdoor store used in this demo. Draft useful, warm, concise replies grounded in this conversation and published Northstar demo knowledge. Search knowledge before stating product specifications or store policies. All customers, orders and policies here are fictional. Do not claim that you checked a live order, changed an address, issued a refund, contacted a warehouse or shipped anything: no commerce integration is available. Ask a focused follow-up when facts are missing. Do not promise delivery dates or unannounced features. Offer drafts for the operator to review.`

const articles = [
  { key: 'gear', title: 'Northstar demo: Ridge 18 daypack fit and trail bottle care', content: `Fictional Northstar Outfitters product guide. Ridge 18 is an 18-litre daypack intended for short day hikes. Its main compartment holds a light rain jacket and packed lunch; its two external stretch pockets each hold a standard 750 ml bottle. Bulky insulated bottles may not fit. The shoulder straps and sternum strap adjust, but height alone cannot establish fit. Ask for torso length or suggest trying the loaded pack; do not guarantee fit for a 160 cm customer. Trail bottle care: remove the silicone lid seal, wash lid and seal with warm soapy water, rinse and air dry fully before reassembly. Consult the care leaflet diagram to seat the seal. These are demo specifications, not claims about a real product.` },
  { key: 'shipping', title: 'Northstar demo: delivery charges and address changes', content: `Fictional Northstar Outfitters delivery policy. Standard delivery costs $12. Delivery is free when the merchandise subtotal after discounts is over $100. A $110 basket reduced to $88 by a welcome discount therefore incurs $12 delivery. Address amendments can only be requested before warehouse packing; the operator must check status before confirming an amendment. Demo order DEMO-1042 has no connected live warehouse record. An apartment number can be noted in the conversation, but no address change has been performed. Never promise arrival by Saturday or another specific date without verified tracking. Do not ask customers to paste a full home address into this demonstration.` },
  { key: 'groupkit', title: 'Northstar demo: trip planner CSV import and shared packing lists', content: `Fictional Northstar Outfitters trip planner help. The CSV importer expects one item per row with a name column. Wrap a field containing a comma in double quotation marks, for example "Stove, compact". Inside a quoted field, escape each double quote by doubling it. Save as UTF-8 CSV and inspect rejected rows before importing again to avoid duplicates. For a 24-row file showing 20 items, inspect the four missing rows; comma quoting is a possible cause, not a confirmed diagnosis without the file. Shared group packing lists, claim-an-item controls and shareable invitation links are feature requests in this demo, not currently released capabilities. Capture the desired group workflow and acknowledge feedback without promising a release date.` },
] as const

/** Add actual retrievable demo knowledge and an operator-assist profile once.
 * No provider request, generation history or conversation AI assignment is created.
 * The marker preserves later owner edits and deliberate deletions on reuse.
 */
export async function ensureDemoInboxAi(env: Env, projectId: string) {
  const now = Date.now(), aiId = `${projectId}-assistant`, datasetId = `${projectId}-faq`, versionId = `${datasetId}-v1`
  const eligible = `EXISTS(SELECT 1 FROM project_settings WHERE project_id=? AND json_extract(settings_json,'$.is_demo')=1 AND json_type(settings_json,'$.demo_ai_seed_version') IS NULL)`
  const statements = [
    env.DB.prepare(`INSERT OR IGNORE INTO ai_profiles(id,project_id,name,role,prompt,model,is_enabled,is_animated,avatar_url,created_at) SELECT ?,?,?,?,?,?,1,0,NULL,? WHERE ${eligible}`).bind(aiId,projectId,'Northstar demo assistant','Support drafting assistant',prompt,'gpt-5.6-luna',now,projectId),
    env.DB.prepare(`INSERT OR IGNORE INTO knowledge_datasets(id,project_id,name,status,published_version,created_at) SELECT ?,?,?,'ready',?,? WHERE ${eligible}`).bind(datasetId,projectId,'Northstar Outfitters · fictional demo FAQ',versionId,now,projectId),
    env.DB.prepare(`INSERT OR IGNORE INTO knowledge_versions(id,dataset_id,fingerprint,created_at,semantic) SELECT ?,?,?,?,0 WHERE ${eligible}`).bind(versionId,datasetId,'northstar-fictional-faq-v1',now,projectId),
    ...articles.map(article => env.DB.prepare(`INSERT OR IGNORE INTO knowledge_documents(id,version_id,url,title,content) SELECT ?,?,?,?,? WHERE ${eligible}`).bind(`${datasetId}-${article.key}`,versionId,`h2h://northstar-demo/${article.key}`,article.title,article.content,projectId)),
  ]
  // json_insert fills only missing keys, respecting explicit nulls and owner choices.
  statements.push(env.DB.prepare(`UPDATE project_settings SET settings_json=json_insert(settings_json,'$.default_visitor_ai_id',?,'$.default_verified_user_ai_id',?,'$.demo_ai_seed_version',1),updated_at=? WHERE project_id=? AND ${eligible}`).bind(aiId,aiId,now,projectId,projectId))
  await env.DB.batch(statements)
}
