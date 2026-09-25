import { HTTPException } from 'hono/http-exception'

const mailboxConflictMessage = 'Inbound mailbox is already configured for another active project'

type EmailSettingsInput = {
 projectId: string
 fromName: string
 fromAddress: string
 inboundAddress: string | null
 enabled: boolean
 updatedAt: number
}

export async function updateEmailSettings(db: D1Database, input: EmailSettingsInput) {
 const conflict = input.inboundAddress && input.enabled
  ? await db.prepare(`
      SELECT e.project_id
      FROM email_settings e
      WHERE lower(e.inbound_address)=?
        AND e.is_enabled=1
        AND e.project_id<>?
        AND NOT EXISTS (
          SELECT 1
          FROM project_settings s
          WHERE s.project_id=e.project_id
            AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL
        )
      LIMIT 1
    `).bind(input.inboundAddress.toLowerCase(),input.projectId).first()
  : null
 if(conflict)throw new HTTPException(409,{message:mailboxConflictMessage})
 try {
  const result=await db.prepare(`
    INSERT INTO email_settings
      (project_id,from_name,from_address,inbound_address,is_enabled,updated_at)
    SELECT ?,?,?,?,?,?
    WHERE NOT EXISTS (
      SELECT 1
      FROM project_settings s
      WHERE s.project_id=?
        AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL
    )
    ON CONFLICT(project_id) DO UPDATE SET
      from_name=excluded.from_name,
      from_address=excluded.from_address,
      inbound_address=excluded.inbound_address,
      is_enabled=excluded.is_enabled,
      updated_at=excluded.updated_at
    WHERE NOT EXISTS (
      SELECT 1
      FROM project_settings s
      WHERE s.project_id=excluded.project_id
        AND json_extract(s.settings_json,'$.deleted_at') IS NOT NULL
    )
  `).bind(input.projectId,input.fromName,input.fromAddress,input.inboundAddress,input.enabled?1:0,input.updatedAt,input.projectId).run()
  if(!result.meta.changes)throw new HTTPException(409,{message:'Project is deleted or unavailable'})
 } catch(error) {
  if(error instanceof HTTPException)throw error
  if(/unique|constraint/i.test(String(error)))throw new HTTPException(409,{message:mailboxConflictMessage})
  throw error
 }
}
