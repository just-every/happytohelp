import type { Context } from 'hono'
import type { Actor, AppEnv } from '../../../platform/env'

export interface WidgetConversation {
  id: string
  revision: number
  assigned_to: string | null
}

/** Object commands have separate fields from context collector/event batches. */
export interface WidgetCommandData {
  ids?: string[]
  resolutionId?: string
  comment?: string
  provided_name?: string
  name?: string
  provided_email?: string
  email?: string
  opened?: unknown
  value?: unknown
  ai_id?: string
  aiId?: string
  id?: string
  insight_id?: string
  insightId?: string
  close?: boolean
  button_id?: string
  label?: string
  text?: string
  ai_message?: { local_id?: string }
  contact_message?: { local_id?: string; content?: string }
  local_id?: string
  requestId?: string
}

export interface WidgetCommand {
  c: Context<AppEnv>
  actor: Actor
  conversation: WidgetConversation
  action: string
  data: WidgetCommandData
}
