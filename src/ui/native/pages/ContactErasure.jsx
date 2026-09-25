import React, {useState} from 'react';
import {nativeRequest} from '../transport';
import {Section} from './forms';

const CONFIRMATION='ERASE';

/** Owner/admin erasure of one contact's personal data, behind an explicit typed confirmation. */
export default function ContactErasure({projectId,contact,onErased}) {
 const [open,setOpen]=useState(false),[typed,setTyped]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=()=>{setOpen(false);setTyped('');setError('');};
 const erase=async()=>{setBusy(true);setError('');try{const response=await nativeRequest(`/api/management/projects/${encodeURIComponent(projectId)}/contacts/${encodeURIComponent(contact.id)}/erase`,{method:'POST'});close();await onErased(response.data);}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div className="contact-erasure"><Section title="Erase personal data" description="Permanently remove this contact's personal data at their request. Only owners and admins can erase a contact.">
  {!open&&<button type="button" className="btn btn-outline-danger" onClick={()=>setOpen(true)}>Erase personal data…</button>}
  {open&&<div className="contact-erasure-confirm" role="group" aria-label="Confirm erasure">
   <p>This permanently deletes, and cannot be undone:</p>
   <ul><li>the contact's name, email, identifier, device and location details</li><li>the content of every message in their conversations, and all attachments</li><li>tracked page visits, customer profiles, insights and other customer context</li><li>their widget sessions, internal notes and AI or delegated-work output on their conversations</li></ul>
   <p>Conversations stay in place with their messages marked as erased. A record of who erased the contact, when, and how many records were removed is kept.</p>
   {error&&<div role="alert" className="alert alert-danger">{error}</div>}
   <div className="form-group"><label htmlFor="contact-erasure-confirmation" className="form-label">Type {CONFIRMATION} to confirm</label><input id="contact-erasure-confirmation" className="form-control" autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)}/></div>
   <div className="settings-actions"><button type="button" className="btn btn-danger" disabled={busy||typed!==CONFIRMATION} onClick={erase}>{busy?'Erasing…':'Permanently erase'}</button><button type="button" className="btn btn-outline-secondary ms-2" disabled={busy} onClick={close}>Cancel</button></div>
  </div>}
 </Section></div>;
}

export function ContactErased({contact}) {
 return <div className="contact-profile"><div role="status" className="alert alert-secondary"><strong>Personal data erased.</strong> This contact was erased on {new Date(contact.erased_at).toLocaleString()}. Their conversations remain with message content and attachments removed.</div><details className="mb-4"><summary>Record details</summary><dl className="contact-facts"><div><dt>ID</dt><dd>{contact.id}</dd></div></dl></details></div>;
}
