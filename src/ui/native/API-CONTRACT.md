# Dashboard data contract

`GET /api/management/bootstrap?projectId=...` must return authenticated real currentAgent {id,name,email}, agents, ais, projects map keyed by id with name/agents/ais/plugins, project for current scope, plugins. UI supplies same-origin /api/dashboard and socket origin; no Laravel token required for same-origin HTTP cookie.

Dashboard data adapter uses `/api/dashboard` prefix for retained endpoint contracts:
- GET /conversations and /projects/:p/conversations with inbox filter query; {data: Conversation[],meta:{pagination:{total,current_page,total_pages}}}
- GET corresponding /counts; {data:{mine,open,unassigned,ai,closed,unread}}
- GET /projects/:p/conversations/:c and /conversations/:c; {data: Conversation}
- GET /projects/:p/conversations/:c/buckets[/:bucketId]; {data: Bucket[]|Bucket,meta:{pagination:{total_pages,current_page}}}
- PUT /projects/:p/conversations/:c resolution/assignment/email transcript; POST notes; participant create/delete
- PUT /projects/:p/contacts/:id; POST /projects/:p/media multipart; GET /projects/:p/macros
- Delegation endpoints retained in hooks/useConversationDelegations.jsx; map to module routes.

Conversation fields: id,project_id,contact_id,contact{display_name,initials,id,is_online},last_message,agent,ai,created_at,resolved_at,unread_contact_messages_count,participants. Bucket fields id,conversation_id,created_at,type:'messages',messages. Messages retain id,local_id,content,created_at,contact/agent/ai,media,read_at,bucket_id,erased_at (set when the contact's personal data was erased; content is then empty).

Native HTTP commands call /api/conversations/:c/messages (frontier first); actions markAsRead/assignAi/agentAssist use /api/dashboard/projects/:p/conversations/:c/actions. Live sockets use /api/conversations/:c/socket after persisted event id, with session-cookie authorization (or bootstrap socketToken if explicitly issued). Replay and live frames translated to original transcript events.

Workspace brand and avatars use authenticated multipart `POST /api/management/projects/:projectId/brand-media` (`file`) returning `{id,url}`. The returned URL is saved in the original `brand_image_url` or `avatar_url` field. The preserved brand generator uses `/api/site-preview/projects/:projectId/brand-image-generations` with one retained `requestId`, polls its explicit state, and publishes its `asset_id` before selection. No provider generation was invoked for local UI verification.

Project insight inventory uses `GET /api/customer-context/:projectId/insights?cursor=...`, with `{data,nextCursor}`. Evidence identifiers are not assumed to be conversation IDs. Unknown document paths return a real TanStack 404; the catchall admits only actual dashboard route patterns.

Contact erasure uses owner/admin `POST /api/management/projects/:projectId/contacts/:contactId/erase` and returns `{data: ContactErasure}` (who, when, runs and removed-record counts). The contact record then carries `metadata_json.is_erased`; the dashboard shows the erased record instead of the edit form. See docs/PRIVACY.md.
