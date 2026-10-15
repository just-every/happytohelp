import React, {useState} from 'react';
import {nativeRequest} from '../transport';

/** Revoke, resend and copy-link controls for one pending invitation. The server decides who may use them.
 * The controls are separated by spaces, like other row actions, so the row's text reads as separate actions. */
export default function InvitationActions({projectId,invitation,emailConfigured,onChanged,onNotice,onError}) {
 const [busy,setBusy]=useState('');
 if(!invitation.canManage)return null;
 const path=`/api/management/projects/${projectId}/invitations/${encodeURIComponent(invitation.invitation_id)}`;
 const run=(name,work)=>async()=>{setBusy(name);onError('');onNotice(null);try{await work();await onChanged()}catch(error){onError(error.message)}finally{setBusy('')}};
 const copyLink=run('link',async()=>{
  const {data}=await nativeRequest(`${path}/link`,{method:'POST'});
  let copied=false;
  try{await navigator.clipboard.writeText(data.invitationUrl);copied=true}catch{copied=false}
  onNotice({kind:'link',email:invitation.email,url:data.invitationUrl,copied});
 });
 const resend=run('resend',async()=>{const {data}=await nativeRequest(`${path}/resend`,{method:'POST'});onNotice({kind:'resent',email:invitation.email,delivery:data.delivery})});
 const revoke=run('revoke',async()=>{await nativeRequest(path,{method:'DELETE'});onNotice({kind:'revoked',email:invitation.email})});
 const label=(name,text,working)=>busy===name?working:text;
 return <div className="management-invite-actions">
  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={Boolean(busy)} onClick={copyLink}>{label('link','Copy link','Copying…')}</button>{' '}
  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={Boolean(busy)||!emailConfigured} title={emailConfigured?undefined:'Email delivery is not configured. Copy the link and share it instead.'} onClick={resend}>{label('resend','Resend','Preparing…')}</button>{' '}
  <button type="button" className="btn btn-sm btn-outline-danger" disabled={Boolean(busy)} onClick={revoke}>{label('revoke','Revoke','Revoking…')}</button>
 </div>;
}

/** The result of the last invitation action, shown above the list. */
export function InvitationNotice({notice}) {
 if(!notice)return null;
 if(notice.kind==='link')return <div className="alert alert-info management-invite-notice" role="status">Invitation link for {notice.email}, valid for 24 hours{notice.copied?' and copied to your clipboard':''}: <a href={notice.url}>{notice.url}</a></div>;
 if(notice.kind==='resent')return <div className="alert alert-success" role="status">{notice.delivery==='captured'?<>Invitation for {notice.email} captured in the <a href="/__dev/outbox">local outbox</a> with a fresh link. No email was sent.</>:<>Invitation sent to {notice.email} again with a fresh link.</>}</div>;
 return <div className="alert alert-success" role="status">Invitation for {notice.email} revoked. Its links no longer work.</div>;
}

/** Sharing a capability is an explicit action, never part of the creation confirmation. */
export function InvitationCreated({invitation}) {
 const [copied,setCopied]=useState(false),[manual,setManual]=useState(false);
 const copy=async()=>{try{await navigator.clipboard.writeText(invitation.invitationUrl);setCopied(true);setManual(false)}catch{setManual(true)}};
 return <div className="mb-3">
  <div className="alert alert-info" role="status">Invitation created. {invitation.delivery==='captured'?<>Captured in the <a href="/__dev/outbox">local outbox</a>. No email was sent.</>:invitation.delivery==='sent'?'Email sent.':'Email delivery is not configured. Copy the invitation link and share it.'}</div>
  <button type="button" className="btn btn-outline-secondary" onClick={copy}>Copy invitation link</button>
  {copied&&<p role="status">Invitation link copied. It works for 24 hours.</p>}
  {manual&&<label className="d-block mt-2">Invitation link to share<input className="form-control" readOnly value={invitation.invitationUrl} onFocus={event=>event.target.select()}/></label>}
 </div>;
}
