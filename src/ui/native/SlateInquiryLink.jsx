import React,{useEffect,useState} from 'react';
import {nativeRequest} from './transport';
/** The native edition supplies only its real case URL; Slate owns its private inquiry context. */
export default function SlateInquiryLink({conversation}) {
 const [clients,setClients]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setClients(null);setError('');nativeRequest(`/api/delegation/connections?projectId=${encodeURIComponent(conversation.project_id)}`).then(r=>{if(active)setClients(r.clients)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[conversation.project_id]);
 const sourceUrl=typeof window==='undefined'?'':`${window.location.origin}/projects/${encodeURIComponent(conversation.project_id)}/conversations/${encodeURIComponent(conversation.id)}`;
 return <section aria-label="Slate investigation" className="conversation-details-section"><h3>Investigate with Slate</h3>{error?<p role="alert">{error}</p>:clients===null?<p role="status">Checking connected applications…</p>:clients.length?clients.map(client=><p key={client.id}><a href={`${client.origin}/app/resolve?sourceUrl=${encodeURIComponent(sourceUrl)}`}>Start investigation{clients.length>1?` in ${client.id}`:''}</a></p>):<p><a href={`/delegation/settings?account_id=${encodeURIComponent(conversation.project_id)}`}>Connect Slate</a></p>}<p>Replies remain in HappyToHelp. Slate requests permission before reading this case.</p></section>;
}
