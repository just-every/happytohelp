import {HTTPException} from 'hono/http-exception'
import {text} from './common'
/** Identity fields for a contact created from the dashboard: at least one of name, email or external ID is required. */
export function newContactInput(body:Record<string,unknown>){
 const name=text(body.name||'',200),email=body.email?text(body.email,320):'',externalId=body.external_id?text(body.external_id,200):''
 if(!name&&!email&&!externalId)throw new HTTPException(400,{message:'Provide a name, an email or an external ID for the contact'})
 return {name,email:email||null,externalId:externalId||null}
}
