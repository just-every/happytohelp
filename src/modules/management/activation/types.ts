export const stepLabels = {
 owner_mail: 'Owner mail delivered', sender_dns: 'Sender DNS', inbound_address: 'Inbound address',
 model_key: 'Model key', spend_ceilings: 'Spend ceilings', published_article: 'First published article',
 widget_origin: 'Widget origin saved', widget_seen: 'Widget seen',
} as const
export type StepId = keyof typeof stepLabels
export type ProbeState = 'not_checked'|'checking'|'pending'|'done'|'failed'|'unavailable'|'unknown'
export type Probe = {state:ProbeState;detail:string;receiptRef?:string|null;actionHref?:string}
export type Receipt = {step_id:StepId;state:ProbeState;fingerprint:string;checked_at:number;detail:string;receipt_ref:string|null;check_token:string}
export const stepIds = Object.keys(stepLabels) as StepId[]
export const providerObservationMs = 15 * 60 * 1000
export const stepPaths:Record<StepId,string> = {
 owner_mail:'email-settings',sender_dns:'email-settings',inbound_address:'email-settings',model_key:'ais',
 spend_ceilings:'ais',published_article:'articles',widget_origin:'widget-settings',widget_seen:'widget-settings',
}
