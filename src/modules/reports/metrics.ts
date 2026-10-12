import type {ReportRow} from './read'
export function durations(row:ReportRow){return {response:row.first_reply_at!==null&&row.first_visitor_at!==null&&row.first_reply_at>=row.first_visitor_at?row.first_reply_at-row.first_visitor_at:null,resolution:row.first_resolved_at!==null&&row.first_resolved_at>=row.created_at?row.first_resolved_at-row.created_at:null}}
