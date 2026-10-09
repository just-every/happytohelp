import React from 'react';
import {nativeRequest} from '../transport';
import {Section} from './forms';
import {useConfirmation} from './ConfirmDialog';

const CONFIRMATION='ERASE';

/** Owner/admin erasure of one contact's personal data, behind the shared dialog's exact typed confirmation. */
export default function ContactErasure({projectId,contact,onErased}) {
 const {ask,dialog}=useConfirmation();
 const begin=()=>ask({
  title:'Erase personal data',confirmText:CONFIRMATION,confirmLabel:'Permanently erase',busyLabel:'Erasing…',
  body:<>
   <p>This permanently deletes, and cannot be undone:</p>
   <ul><li>the contact's name, email, identifier, device and location details</li><li>the content of every message in their conversations, and all attachments</li><li>tracked page visits, customer profiles, insights and other customer context</li><li>their widget sessions, internal notes and AI or delegated-work output on their conversations</li></ul>
   <p>Conversations stay in place with their messages marked as erased. A record of who erased the contact, when, and how many records were removed is kept.</p>
  </>,
  run:async()=>{const response=await nativeRequest(`/api/management/projects/${encodeURIComponent(projectId)}/contacts/${encodeURIComponent(contact.id)}/erase`,{method:'POST'});await onErased(response.data);},
 });
 return <div className="contact-erasure"><Section title="Erase personal data" description="Permanently remove this contact's personal data at their request. Only owners and admins can erase a contact.">
  <button type="button" className="btn btn-outline-danger" onClick={begin}>Erase personal data…</button>
 </Section>{dialog}</div>;
}

export function ContactErased({contact}) {
 return <div className="contact-profile"><div role="status" className="alert alert-secondary"><strong>Personal data erased.</strong> This contact was erased on {new Date(contact.erased_at).toLocaleString()}. Their conversations remain with message content and attachments removed.</div><details className="mb-4"><summary>Record details</summary><dl className="contact-facts"><div><dt>ID</dt><dd>{contact.id}</dd></div></dl></details></div>;
}
