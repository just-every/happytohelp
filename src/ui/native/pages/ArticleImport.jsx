import React, { useState } from 'react';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';
export default function ArticleImport({ projectId }) {
    const [platform,setPlatform]=useState('zendesk'),[subdomain,setSubdomain]=useState(''),[error,setError]=useState(''),[job,setJob]=useState(null);
    const submit=async event=>{event.preventDefault();setError('');try{setJob(await nativeRequest(`/api/knowledge/${projectId}/import/${platform}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subdomain})}));}catch(error){setError(error.message);}};
    const refresh=async()=>{try{setJob(await nativeRequest(`/api/knowledge/${projectId}/imports/${job.id}`));}catch(error){setError(error.message);}};
    return <div className="workspace-settings"><Feedback error={error}/><ul className="nav nav-tabs mb-4">{['zendesk','freshdesk','intercom'].map(name=><li key={name} className="nav-item"><button className={`nav-link ${platform===name?'active':''}`} onClick={()=>setPlatform(name)}>{name}</button></li>)}</ul><form onSubmit={submit}><Section title="Import articles"><p>Import your existing help center content.</p><Field name="subdomain" label="Help center subdomain" value={subdomain} onChange={(_,value)=>setSubdomain(value)} required/></Section><button className="btn btn-primary">Import</button></form>{job&&<Section title="Import progress"><p role="status">{job.status}</p>{job.counts&&<p>{JSON.stringify(job.counts)}</p>}<button className="btn btn-white" onClick={refresh}>Refresh status</button></Section>}</div>;
}
