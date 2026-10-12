-- Preserve every original message. Historical operator drafting and handoffs
-- were not recorded, so absence of those facts never becomes human/AI proof.
INSERT INTO reporting_legacy_conversations(project_id,conversation_id,run_id)
 SELECT c.project_id,c.id,MIN(r.run_id) FROM legacy_import_rows r JOIN conversations c ON c.id=r.source_id AND c.project_id=CAST(json_extract(r.source_json,'$.project_id') AS TEXT)
 WHERE r.source_table='conversations' AND r.status='mapped' GROUP BY c.project_id,c.id;
INSERT INTO conversation_tracking(conversation_id,project_id,initial_history_complete,cycle_history_complete,cycle_start_revision,cycle_start_at)
 SELECT c.id,c.project_id,0,0,c.revision,c.created_at FROM conversations c
 WHERE NOT EXISTS(SELECT 1 FROM move_in_conversations i WHERE i.project_id=c.project_id AND i.conversation_id=c.id) AND NOT EXISTS(SELECT 1 FROM reporting_legacy_conversations i WHERE i.project_id=c.project_id AND i.conversation_id=c.id);
INSERT INTO message_authorship(message_id,project_id,kind,source_kind,source_id,recorded_at)
 SELECT m.id,m.project_id,CASE WHEN m.actor_role='contact' THEN 'visitor' WHEN EXISTS(SELECT 1 FROM local_receipts r JOIN local_jobs j ON j.id=r.job_id WHERE r.message_id=m.id AND r.kind='reply' AND r.status='sent' AND j.project_id=m.project_id AND j.conversation_id=m.conversation_id AND j.operator_id=m.actor_id) THEN 'assisted' WHEN EXISTS(SELECT 1 FROM ai_generations g WHERE m.actor_role='ai' AND m.local_id='generation:'||g.id AND g.project_id=m.project_id AND g.conversation_id=m.conversation_id AND g.ai_id=m.actor_id AND g.state='completed') THEN 'ai' ELSE 'unknown' END,CASE WHEN m.actor_role='ai' AND m.actor_id='ai' AND EXISTS(SELECT 1 FROM context_insights i JOIN conversations c ON c.id=m.conversation_id AND c.contact_id=i.subject_id AND c.project_id=i.project_id JOIN messages response ON response.conversation_id=m.conversation_id AND response.revision=m.revision+1 AND response.actor_role='contact' AND response.created_at=m.created_at WHERE i.project_id=m.project_id AND i.content=m.content AND EXISTS(SELECT 1 FROM json_each(i.buttons) b WHERE CASE WHEN b.type='text' THEN b.value ELSE COALESCE(json_extract(b.value,'$.text'),json_extract(b.value,'$.label')) END=response.content)) THEN 'insight' ELSE 'historical' END,NULL,m.created_at
 FROM messages m JOIN conversation_tracking t ON t.conversation_id=m.conversation_id;
INSERT INTO conversation_resolutions(id,project_id,conversation_id,contact_id,ordinal,resolved_at,resolved_revision,cycle_start_revision,outcome,evidence_json)
 SELECT 'historical:'||c.id,c.project_id,c.id,c.contact_id,1,c.resolved_at,c.revision,0,
 'unknown',
 '{"historyComplete":false,"historicalResolutionOrderUnknown":true}' FROM conversations c JOIN conversation_tracking t ON t.conversation_id=c.id WHERE c.resolved_at IS NOT NULL;
