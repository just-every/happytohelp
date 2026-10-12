export const stepLabels = {
 owner_mail: 'Check a test email arrives', sender_dns: 'Verify your sending address', inbound_address: 'Receive replies by email',
 model_key: 'Connect an AI provider', spend_ceilings: 'Set limits for AI use', published_article: 'Publish a help article',
 widget_origin: 'Choose the website for your widget', widget_seen: 'Open the widget on your website',
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
