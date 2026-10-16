import { type Row,type LegacyBundle,type MappedRow,timestamp,text,stable } from './types'
import {columns,truth} from './mapping-shared'

function helpCenterAddress(value:unknown){
 if(value===null||value===undefined||value==='')return value
 const input=text(value,'projects.help_center_domain').trim()
 const address=new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input)?input:`https://${input}`)
 if(address.username||address.password||!address.hostname||(address.protocol!=='https:'&&!(address.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(address.hostname))))throw new Error('Invalid legacy Help Center URL')
 return address.href
}

export function mapProject(r:Row,b:LegacyBundle):MappedRow[]{
 const id=text(r.id,'projects.id'),name=text(r.name,'projects.name'),updated=timestamp(r.updated_at||r.created_at)
 const result:MappedRow[]=[{table:'projects',row:{id,name,widget_key:r.widget_key||r.public_key||id,allowed_origin:new URL(text(r.allowed_origin||r.website||r.website_url||r.url,'projects.allowed_origin')).origin,created_at:timestamp(r.created_at),verification_secret:r.verification_secret??null},key:['id']}]
 const metadata=(typeof r.metadata==='string'?JSON.parse(r.metadata):r.metadata||{}) as Row
 const settings:Row={
  ...((metadata.dashboard||{}) as Row),
  ...Object.fromEntries(Object.entries(columns(r,['default_visitor_ai_id','default_verified_user_ai_id','is_availability_schedule_enabled','is_contact_tracking_enabled','is_human_response_enabled','timezone','help_center_domain','deleted_at'])).map(([key,value])=>[key,key.startsWith('is_')?truth(value):value])),
  ...(r.widget_settings?{widget_settings:typeof r.widget_settings==='string'?JSON.parse(r.widget_settings):r.widget_settings}:{}),
  ...(r.availability_schedule?{availability_schedule:typeof r.availability_schedule==='string'?JSON.parse(r.availability_schedule):r.availability_schedule}:{}),
  ...(r.avatar_url?{logo_url:r.avatar_url}:{})
 }
 if('help_center_domain' in settings)settings.help_center_domain=helpCenterAddress(settings.help_center_domain)
 if(Object.keys(settings).length)result.push({table:'project_settings',row:{project_id:id,settings_json:stable(settings),updated_at:updated},key:['project_id']})
 let inbound:string|null=null
 if(r.slug){
  const slug=text(r.slug,'projects.slug'),domain=text(b.source.mailFromDomain,'source.mailFromDomain (legacy mail.from.domain)')
  if(!/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(domain)||domain.split('.').some(part=>!part||part.startsWith('-')||part.endsWith('-')))throw new Error('Invalid legacy mail domain')
  inbound=`${slug}@mail.${domain}`
  result.push({table:'public_project_aliases',row:{slug,project_id:id},key:['slug']})
 }
 if(inbound||r.email_from_address){
  result.push({table:'email_settings',row:{project_id:id,from_name:r.email_from_name||name,from_address:r.email_from_address||inbound,inbound_address:inbound,is_enabled:0,updated_at:updated},key:['project_id']})
 }
 return result
}
