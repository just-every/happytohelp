import React,{useEffect,useState} from 'react';
import {nativeRequest} from '../../transport';
import {useDashboardSettings} from '../../dashboard-state';
import {Feedback,Section} from '../forms';
import {useConfirmation} from '../ConfirmDialog';
import '../stack-table.css';
import './security.css';

const ROLES=[['owner','Owners'],['admin','Admins'],['operator','Agents'],['collaborator','Collaborators']];
const LABELS={owner:'Owner',admin:'Admin',operator:'Agent',collaborator:'Collaborator'};
const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

/** Settings → Security: who must use two-factor sign-in, who has it, and an owner's reset of a teammate's factor. */
export default function SecurityPage({projectId,role}){
 const {currentAgent}=useDashboardSettings(),{ask,dialog}=useConfirmation();
 const path=`/api/management/projects/${projectId}/security`;
 const [data,setData]=useState(null),[roles,setRoles]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{try{const result=(await nativeRequest(path)).data;setData(result);setRoles(result.two_factor_roles);}catch(e){setError(e.message)}};
 useEffect(()=>{if(['owner','admin'].includes(role))load();},[path,role]);
 if(!['owner','admin'].includes(role))return <p role="alert">Only workspace owners and admins can see security settings.</p>;
 if(!data)return <Feedback error={error}/>;
 const owner=role==='owner',changed=JSON.stringify([...roles].sort())!==JSON.stringify([...data.two_factor_roles].sort());
 const save=async event=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{const result=(await nativeRequest(path,json('PUT',{two_factor_roles:roles}))).data;setNotice(result.sessionsEnded?`Saved. ${result.sessionsEnded} session${result.sessionsEnded===1?'':'s'} without two-factor ended.`:'Saved.');await load();}catch(e){setError(e.message)}setBusy(false)};
 const reset=member=>ask({title:`Reset ${member.name}’s two-factor sign-in?`,confirmLabel:'Reset',busyLabel:'Resetting…',
  body:<><p>Their authenticator apps, passkeys and recovery codes are removed and they are signed out everywhere. They set up a new factor at their next sign-in.</p><p>We email them to say it happened.</p></>,
  run:async()=>{await nativeRequest(`/api/management/projects/${projectId}/agents/${member.id}/two-factor/reset`,{method:'POST'});setNotice(`${member.name}’s two-factor sign-in was reset.`);await load();}});
 const unenrolled=data.members.filter(member=>roles.includes(member.policy_role)&&!member.enrolled);
 return <div className="workspace-settings security-page">
  <Feedback error={error}/>{notice&&<div role="status" className="alert alert-success">{notice}</div>}
  <form onSubmit={save}><Section title="Two-factor sign-in" description="Require a second step, an authenticator app code or a passkey, when these teammates sign in. They set one up at their next sign-in before they can see anything, and their sessions without it end now.">
   <fieldset disabled={!owner||busy}><legend className="visually-hidden">Roles that must use two-factor sign-in</legend>
    {ROLES.map(([key,label])=><div className="form-check" key={key}><input className="form-check-input" type="checkbox" id={`tf-${key}`} checked={roles.includes(key)} onChange={event=>setRoles(event.target.checked?[...roles,key]:roles.filter(item=>item!==key))}/><label className="form-check-label" htmlFor={`tf-${key}`}>{label}</label></div>)}
   </fieldset>
   {!owner&&<p className="settings-note">Only an owner can change this. Changing it asks for the owner’s own second factor.</p>}
   {owner&&changed&&unenrolled.length>0&&<p className="settings-note" role="status">{unenrolled.length} teammate{unenrolled.length===1?'':'s'} will have to set up two-factor sign-in at their next sign-in.</p>}
   {owner&&<div className="settings-actions"><button className="btn btn-primary" disabled={busy||!changed}>{busy?'Saving…':'Save policy'}</button></div>}
  </Section></form>
  <Section title="Teammates" description="Who has turned on two-factor sign-in.">
   <div className="table-responsive"><table className="table stack-table security-members"><thead><tr><th>Name</th><th>Role</th><th>Two-factor</th>{owner&&<th><span className="visually-hidden">Actions</span></th>}</tr></thead><tbody>
    {data.members.map(member=><tr key={member.id}><td data-label="Name"><span>{member.name}<br/><small className="text-muted">{member.email}</small></span></td><td data-label="Role">{LABELS[member.policy_role]||member.policy_role}</td>
     <td data-label="Two-factor">{member.enrolled?<span className="security-badge security-badge--on">On</span>:<span className={`security-badge${roles.includes(member.policy_role)?' security-badge--due':''}`}>{roles.includes(member.policy_role)?'Required, not set up':'Off'}</span>}</td>
     {owner&&<td className="stack-table__actions">{member.enrolled&&member.id!==currentAgent?.id&&<span className="row-actions-inline"><button type="button" onClick={()=>reset(member)}>Reset two-factor</button></span>}</td>}</tr>)}
   </tbody></table></div>
  </Section>
  <Section title="Lost every factor?" description="An owner who loses every second factor recovers with the installation’s owner recovery key, set through rer. Email alone never recovers an account.">
   <p className="settings-note">Hosted: run <code>rer deploy --environment production --set-secret H2H_OWNER_RECOVERY_KEY</code> with a new key of at least 32 characters, then open <a href="/owner-recovery">/owner-recovery</a>. Local: the key is in this checkout’s private <code>.dev.vars</code>, and <code>rer dev</code> signs the owner in directly.</p>
  </Section>
  {dialog}</div>;
}
