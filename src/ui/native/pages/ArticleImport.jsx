import { useDashboardLocation } from '../dashboard-state';
import { useUnsavedChanges } from '../NavigationGuard';
import React, { useState } from 'react';
import { nativeRequest } from '../transport';
import { Field, Feedback } from './forms';
import './knowledge/knowledge.css';
export default function ArticleImport({ projectId }) {
 const {markDirty,markSaved}=useUnsavedChanges();

 const routeLocation=useDashboardLocation();

 const initial=routeLocation.pathname.split('/')[5];
 const [platform,setPlatform]=useState(['zendesk','freshdesk','intercom'].includes(initial)?initial:null),[subdomain,setSubdomain]=useState(''),[error,setError]=useState(''),[job,setJob]=useState(null),[busy,setBusy]=useState(false);
 const submit=async event=>{event.preventDefault();setError('');setBusy(true);try{setJob(await nativeRequest(`/api/knowledge/${projectId}/import/${platform}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subdomain})}));markSaved();}catch(error){setError(error.message);}finally{setBusy(false);}};
 const refresh=async()=>{setBusy(true);try{setJob(await nativeRequest(`/api/knowledge/${projectId}/imports/${job.id}`));}catch(error){setError(error.message);}finally{setBusy(false);}};
 return <div className="knowledge-form"><Feedback error={error}/>{!platform?<><p className="knowledge-import-intro">Please choose which helpdesk you would like to import help articles from.</p><div className="knowledge-import-options">{['zendesk','intercom','freshdesk'].map(name=><button className="btn btn-white" key={name} onClick={()=>setPlatform(name)}>{name[0].toUpperCase()+name.slice(1)}</button>)}</div></>:<><div className="mb-4"><button className="btn btn-link p-0" onClick={()=>{setPlatform(null);setJob(null);}}>‹ Choose another helpdesk</button></div><form onSubmit={submit}><h2 className="knowledge-website-title">Import articles from {platform[0].toUpperCase()+platform.slice(1)}</h2><p className="settings-note">Import uses this installation's configured {platform} credentials. Account credentials cannot be entered here.</p>{platform!=='intercom'&&<Field name="subdomain" label="Subdomain" value={subdomain} onChange={(_,value)=>{markDirty();setSubdomain(value);}} required/>}<button className="btn btn-primary" disabled={busy||Boolean(job)}>{busy?'Submitting…':'Import'}</button></form></>}{job&&<section className="mt-4"><h2 className="knowledge-website-title">Import progress</h2><p role="status">{job.status}</p>{job.error&&<p role="alert">{job.error}</p>}<p>Articles: {job.articles??'Not recorded'} · Categories: {job.categories??'Not recorded'}</p><button className="btn btn-white" disabled={busy} onClick={refresh}>Refresh status</button></section>}</div>;
}
