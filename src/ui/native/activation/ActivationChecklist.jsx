import React,{useId} from 'react';
import {Link} from '@tanstack/react-router';
import useActivation from './useActivation';
import ProviderSetupNotice from './ProviderSetupNotice';
import './activation.css';
const trialRequirements={owner_mail:'Not needed for a local trial. Use the local outbox when local mail is selected.',sender_dns:'Not needed for a local trial. Verify this before sending email to customers.',inbound_address:'Not needed for a local trial. Connect this to receive replies by email.',model_key:'Not needed for a local trial with human replies. Connect this to use AI.',spend_ceilings:'Not needed for a local trial with human replies. Set these before using AI.',published_article:'Not needed for a local trial. Publish an article when you want to share help.',widget_origin:'Needed for a local trial of the widget. Choose its exact website address.',widget_seen:'Needed for a local trial of the widget. Open it to check the connection.'};
const checkLabels={owner_mail:'Check email delivery',sender_dns:'Check sending address',inbound_address:'Check email replies',model_key:'Check AI connection',spend_ceilings:'Check AI limits',published_article:'Check article',widget_origin:'Check widget website',widget_seen:'Check widget activity'};
const stateLabels={not_checked:'Not checked',checking:'Checking',pending:'Pending',done:'Done',failed:'Failed',unavailable:'Needs setup',unknown:'Unknown'};
export default function ActivationChecklist({projectId,compact=false,role}) {
 const {data,error,busy,check,testMail}=useActivation(projectId),heading=useId();
 return <section className={`activation-checklist${compact?' activation-checklist--compact':''}`} aria-labelledby={heading} data-testid="activation-checklist">
  <div className="activation-heading"><div><h2 id={heading}>Set up your workspace</h2><p className="activation-progress" role="status">{data?`${data.done} of ${data.total} done`:'Loading setup checklist…'}</p></div>{compact&&<Link to={`/projects/${projectId}/activation`}>Open setup page</Link>}</div>
  <p>Validate the connections that let your customers reach you. Checks are saved for this workspace and show when each connection was observed.</p>
  {(!role||['owner','admin'].includes(role))&&<p><Link to={`/projects/${projectId}/move-in`}>Move in existing support history</Link> (optional)</p>}
  {error&&<p role="alert">{error}</p>}
  {data&&<><ol className="activation-steps">{data.steps.map(step=><li key={step.id} data-step={step.id} data-state={step.state}>
   <div className="activation-step-heading"><h3>{step.label}</h3><span className={`activation-state activation-state--${step.state}`}>{busy==='all'||busy===step.id?'Checking…':stateLabels[step.state]}</span></div>
   <p className="activation-trial-requirement">{trialRequirements[step.id]}</p><p>{step.detail}</p>
   {step.checkedAt&&<p className="activation-checked">Last checked <time dateTime={step.checkedAt}>{new Date(step.checkedAt).toISOString().replace('T',' ').replace('.000Z',' UTC')}</time></p>}
   <div className="activation-step-actions"><Link to={step.actionHref}>{step.id==='published_article'&&step.state==='done'?'Open article':'Configure'}</Link><button type="button" className="btn btn-sm btn-white" disabled={Boolean(busy)} onClick={()=>check(step.id)}>{checkLabels[step.id]}</button>{step.id==='owner_mail'&&<button type="button" className="btn btn-sm btn-white" disabled={Boolean(busy)} onClick={testMail}>Send or check test mail</button>}</div>
   {step.detail.includes('CONFIGURATION_REQUIRED')&&<ProviderSetupNotice projectId={projectId} error={step.detail} kind={['owner_mail','sender_dns','inbound_address'].includes(step.id)?'email':'model'} compact/>}
  </li>)}</ol><div className="activation-footer"><button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={()=>check()}>{busy?'Checking…':'Check setup'}</button><p>Check setup reads provider status and your saved configuration. It does not send mail or generate AI answers. Test mail sends at most one message per owner and sender configuration; uncertain sends are never replayed.</p></div></>}
 </section>;
}
