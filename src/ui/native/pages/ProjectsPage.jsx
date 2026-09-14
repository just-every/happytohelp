import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';
export default function ProjectsPage() {
    const [items,setItems]=useState([]),[draft,setDraft]=useState({name:'',website:'',allowed_origin:''}),[error,setError]=useState('');
    const creating=location.pathname.endsWith('/create');
    useEffect(()=>{nativeRequest('/api/management/projects').then(r=>setItems(r.data)).catch(e=>setError(e.message));},[]);
    const change=(name,value)=>setDraft(d=>({...d,[name]:value}));
    const submit=async e=>{e.preventDefault();try{const created=await nativeRequest('/api/management/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});await nativeRequest('/api/identity/switch-project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:created.id})});location.assign(`/projects/${created.id}/widget-settings`);}catch(e){setError(e.message);}};
    return <><Feedback error={error}/>{creating?<div className="workspace-settings"><form onSubmit={submit}><Section title="Project details"><div className="settings-grid"><Field name="name" label="Name" value={draft.name} onChange={change} required/><Field name="website" label="Website" type="url" value={draft.website} onChange={change} required/><Field name="allowed_origin" label="Widget website origin" type="url" value={draft.allowed_origin} onChange={change} required/></div></Section><button className="btn btn-primary">Create project</button></form></div>:<><a className="btn btn-primary mb-4" href="/projects/create">Create project</a><div className="row">{items.map(project=><div className="col-lg-6" key={project.id}><article className="card"><div className="card-body"><h2 className="card-title"><a href={`/projects/${project.id}/conversations`}>{project.name}</a></h2><p>{project.website||project.allowed_origin}</p><a href={`/projects/${project.id}/edit`}>Settings</a></div></article></div>)}</div></>}</>;
}
