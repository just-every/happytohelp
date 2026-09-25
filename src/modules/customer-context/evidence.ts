import { hashToken } from '../../platform/auth'
export interface Evidence { id:string;source:string;content:string;visibility:string;occurred_at:number }
export interface ProfileField {value:unknown;evidence_status:string;evidence_ids:string[];confidence?:number}
export const PROFILE_KEYS={project:['describe','short_name','legal_name','primary_pages','type','business_model','possible_users','brand_personality'],agent:['personality','common_greetings','common_sign_off','uniqueness'],contact:['upcoming_events','user_type','problem','solutions_needed','job','role','risk_profile','personality']}
export type ProfileType=keyof typeof PROFILE_KEYS
export const INTERVALS={project:[0,600000,86400000],agent:[0,600000,86400000],contact:[0,120000,600000,6000000,86400000]}
export function cooldown(type:ProfileType,count:number){return INTERVALS[type][Math.min(Math.max(0,Math.floor(count)),INTERVALS[type].length-1)]}
export function eligibleEvidence(input:Evidence[]):Evidence[]{return input.filter(e=>!/^detected extended inactivity\s*\(\d+ seconds without interaction\)\s*-\s*user may be hesitating\.?$/i.test(e.content.trim())).slice(-64).map(e=>({...e,content:e.content.replaceAll('\u0000','').slice(0,e.source==='approved_knowledge_document'?2400:1000)}))}
export function validateProfile(type:ProfileType,candidate:unknown,evidence:Evidence[]):candidate is Record<string,ProfileField>{
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return false;const allowed=new Set(evidence.map(e=>e.id));const values=candidate as Record<string,ProfileField>;
 return PROFILE_KEYS[type].every(key=>{const field=values[key];if(!field||!Array.isArray(field.evidence_ids)||!field.evidence_ids.every(id=>allowed.has(id)))return false;
 return field.evidence_status==='supported'?field.value!==null&&Number.isInteger(field.confidence)&&field.confidence!>=0&&field.confidence!<=100&&field.evidence_ids.length>0:field.value===null&&(['unknown','contradicted'].includes(field.evidence_status))&&(field.evidence_status!=='contradicted'||field.evidence_ids.length>0)})
}
const USER_TYPES=new Set(['visitor','buyer','subscriber','researcher','student','developer','support_seeker','administrator','partner','client_customer','influencer','other'])
const PERSONALITIES=new Set(['concise','informative','conversational','creative','analytical','empathetic','decisive','explorative','collaborative'])
export function publicSignals(profile:Record<string,ProfileField>,consent:boolean){if(!consent)return [];return Object.entries(profile).filter(([k,v])=>v.evidence_status==='supported'&&(v.confidence||0)>=60&&v.evidence_ids?.length&&typeof v.value==='string'&&(k==='user_type'?USER_TYPES.has(v.value):k==='personality'&&PERSONALITIES.has(v.value))).map(([key,v])=>({key,value:v.value}))}
export async function fingerprint(evidence:Evidence[]){return hashToken(JSON.stringify(evidence.map(e=>({id:e.id,source:e.source,content:e.content}))))}
