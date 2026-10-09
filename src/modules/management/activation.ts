import {Hono} from 'hono'
import {HTTPException} from 'hono/http-exception'
import type {AppEnv} from '../../platform/env'
import {scope} from './common'
import {activationConfiguration} from './activation/configuration'
import {activationSnapshot,startCheck,finishCheck} from './activation/store'
import {stepIds,type StepId,type Probe} from './activation/types'
import {checkModel} from './activation/model-probe'
import {checkOwnerMail,checkSenderDns,sendOwnerTestMail} from './activation/mail-probes'
import {localProbe} from './activation/local-probes'
import {ProbeFailure} from './activation/provider-http'

export const activation=new Hono<AppEnv>()
const path='/projects/:projectId/activation'
async function ownerScope(c:Parameters<typeof scope>[0]) {
 const actor=await scope(c,true)
 // Membership checks alone do not deny a path project whose memberships were retained in a partial deletion.
 if(await c.env.DB.prepare("SELECT project_id FROM project_settings WHERE project_id=? AND json_extract(settings_json,'$.deleted_at') IS NOT NULL").bind(actor.projectId).first())throw new HTTPException(403)
 return actor
}
activation.get(path,async c=>{
 const actor=await ownerScope(c)
 const config=await activationConfiguration(c.env,actor.projectId)
 c.header('Cache-Control','no-store')
 return c.json({data:await activationSnapshot(c.env,config)})
})
activation.post(`${path}/check`,async c=>{
 const actor=await ownerScope(c),body=await c.req.json()
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='step')||body.step!==undefined&&!stepIds.includes(body.step))throw new HTTPException(400,{message:'Choose a checklist step to check; completion cannot be set manually.'})
 const config=await activationConfiguration(c.env,actor.projectId)
 const ids:StepId[]=body.step?[body.step]:stepIds
 await Promise.all(ids.map(async id=>{
  const token=await startCheck(c.env,config,id);if(!token)return
  let result:Probe
  try {result=id==='model_key'?await checkModel(config):id==='owner_mail'?await checkOwnerMail(c.env,config):id==='sender_dns'?await checkSenderDns(c.env,config):await localProbe(c.env,config,id)}
  catch(error){result=error instanceof ProbeFailure?error.probe:{state:'unknown',detail:'The check could not complete. Its outcome remains unknown; no provider work was replayed.'}}
  await finishCheck(c.env,config,id,token,result)
 }))
 c.header('Cache-Control','no-store')
 return c.json({data:await activationSnapshot(c.env,await activationConfiguration(c.env,actor.projectId))})
})
activation.post(`${path}/test-mail`,async c=>{
 const actor=await ownerScope(c)
 if(actor.role!=='owner')throw new HTTPException(403,{message:'Only a workspace owner can send their test mail.'})
 const body=await c.req.json()
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new HTTPException(400,{message:'Test mail goes only to the authenticated owner; no recipient or completion can be supplied.'})
 const config=await activationConfiguration(c.env,actor.projectId),token=await startCheck(c.env,config,'owner_mail')
 if(token) {
  let result:Probe
  try {result=await sendOwnerTestMail(c.env,config,actor.id)}catch(error){result=error instanceof ProbeFailure?error.probe:{state:'unknown',detail:'Test mail outcome is unknown. Reconcile provider status before any further send.'}}
  await finishCheck(c.env,config,'owner_mail',token,result)
 }
 c.header('Cache-Control','no-store')
 return c.json({data:await activationSnapshot(c.env,await activationConfiguration(c.env,actor.projectId))})
})
