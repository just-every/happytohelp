import React, {useState} from 'react';
import {nativeRequest} from '../transport';

/** Revoke, resend and copy-link controls for one pending invitation. The server decides who may use them. */
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
 const resend=run('resend',async()=>{await nativeRequest(`${path}/resend`,{method:'POST'});onNotice({kind:'resent',email:invitation.email})});
 const revoke=run('revoke',async()=>{await nativeRequest(path,{method:'DELETE'});onNotice({kind:'revoked',email:invitation.email})});
 const label=(name,text,working)=>busy===name?working:text;
 return <div className="management-invite-actions">
  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={Boolean(busy)} onClick={copyLink}>{label('link','Copy link','Copying…')}</button>
  <button type="button" className="btn btn-sm btn-outline-secondary" disabled={Boolean(busy)||!emailConfigured} title={emailConfigured?undefined:'Email delivery is not configured. Copy the link and share it instead.'} onClick={resend}>{label('resend','Resend','Sending…')}</button>
  <button type="button" className="btn btn-sm btn-outline-danger" disabled={Boolean(busy)} onClick={revoke}>{label('revoke','Revoke','Revoking…')}</button>
 </div>;
}

/** The result of the last invitation action, shown above the list. */
export function InvitationNotice({notice}) {
 if(!notice)return null;
 if(notice.kind==='link')return <div className="alert alert-info management-invite-notice" role="status">Invitation link for {notice.email}, valid for 24 hours{notice.copied?' and copied to your clipboard':''}: <a href={notice.url}>{notice.url}</a></div>;
 if(notice.kind==='resent')return <div className="alert alert-success" role="status">Invitation emailed to {notice.email} again with a fresh link.</div>;
 return <div className="alert alert-success" role="status">Invitation for {notice.email} revoked. Its links no longer work.</div>;
}
