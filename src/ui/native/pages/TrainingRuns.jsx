import { useUnsavedChanges } from '../NavigationGuard';
import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../transport';
import { Section, Feedback } from './forms';
import KnowledgeTabs from './knowledge/KnowledgeTabs';
import TrainingRunForm from './TrainingRunForm';
import { kindLabel } from './training-run-form';
import './stack-table.css';
export default function TrainingRuns({ projectId }) {
 const {markSaved}=useUnsavedChanges();
 const path=`/api/training/projects/${projectId}/runs`;
 const [runs,setRuns]=useState(null),[error,setError]=useState(''),[created,setCreated]=useState(false),[selected,setSelected]=useState(null);
 const load=()=>nativeRequest(path).then(r=>setRuns(r.data||r.runs||r)).catch(e=>setError(e.message));
 useEffect(()=>{load();},[path]);
 const create=async value=>{
  setError('');setCreated(false);
  await nativeRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,request_id:crypto.randomUUID()})});
  markSaved();setCreated(true);await load();
 };
 const inspect=async id=>{try{const result=await nativeRequest(`${path}/${id}`);setSelected(result.data||result);}catch(e){setError(e.message);}};
 const cancel=async id=>{try{await nativeRequest(`${path}/${id}/cancel`,{method:'POST'});await inspect(id);await load();}catch(e){setError(e.message);}};
 return <div className="workspace-settings"><KnowledgeTabs projectId={projectId} activeSection="training-runs"/><Feedback error={error}/>{created&&<div role="status" className="alert alert-success">Run created. It appears in the list below once it is queued.</div>}
  <Section title="Recent runs" description="Evaluations and simulations run your own cases against the models you choose, and keep each output for review.">
   {runs&&!runs.length?<p className="settings-note">No evaluation runs yet. Start one below to compare models on your own cases.</p>
   :<div className="table-responsive"><table className="table stack-table"><thead><tr><th>Run</th><th>Status</th><th>Cost</th></tr></thead><tbody>{(runs||[]).map(run=><tr key={run.id}><td data-label="Run"><button className="btn btn-link" onClick={()=>inspect(run.id)}>{kindLabel(run.kind)}</button></td><td data-label="Status">{run.status}</td><td data-label="Cost">{run.cost ?? 'Not recorded'}</td></tr>)}</tbody></table></div>}
  </Section>
  {selected&&<Section title="Run details"><p>Status: {selected.status}</p><button className="btn btn-white" onClick={()=>cancel(selected.id)}>Cancel run</button>{selected.cases?.map(item=><article key={item.id}><h3>{item.name||item.id}</h3><p>{item.status}</p><a href={`${path}/${selected.id}/cases/${item.id}/artifact`}>Open retained artifact</a></article>)}</Section>}
  <TrainingRunForm onCreate={create}/></div>;
}
