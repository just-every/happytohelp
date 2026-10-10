import { useUnsavedChanges } from '../NavigationGuard';
import React from 'react';
import { Section, Feedback } from './forms';
import KnowledgeTabs from './knowledge/KnowledgeTabs';
import TrainingRunForm from './TrainingRunForm';
import { kindLabel } from './training-run-form';
import useTrainingRuns from './useTrainingRuns';
import './stack-table.css';
export default function TrainingRuns({ projectId }) {
 return <ProjectTrainingRuns key={projectId} projectId={projectId}/>;
}
function ProjectTrainingRuns({ projectId }) {
 const {markSaved}=useUnsavedChanges();
 const path=`/api/training/projects/${projectId}/runs`;
 const {runs,status,error,created,selected,pending,load,create,inspect,cancel}=useTrainingRuns(path,markSaved);
 return <div className="workspace-settings"><KnowledgeTabs projectId={projectId} activeSection="training-runs"/><Feedback error={error}/>{created&&<div role="status" className="alert alert-success">Run created. It appears in the list below once it is queued.</div>}
  <Section title="Recent runs" description="Evaluations and simulations run your own cases against the models you choose, and keep each output for review.">
   {status==='loading'?<p role="status">Loading evaluation runs…</p>
   :status==='error'?<><p>Evaluation runs could not be loaded. Load the list before starting a run.</p><button className="btn btn-white" onClick={load}>Load runs</button></>
   :!runs.length?<p className="settings-note">No evaluation runs yet. Start one below to compare models on your own cases.</p>
   :<div className="table-responsive"><table className="table stack-table"><thead><tr><th>Run</th><th>Status</th><th>Cost</th></tr></thead><tbody>{runs.map(run=><tr key={run.id}><td data-label="Run"><button className="btn btn-link" disabled={pending} onClick={()=>inspect(run.id)}>{kindLabel(run.kind)}</button></td><td data-label="Status">{run.status}</td><td data-label="Cost">{run.cost ?? 'Not recorded'}</td></tr>)}</tbody></table></div>}
  </Section>
  {selected&&<Section title="Run details"><p>Status: {selected.status}</p><button className="btn btn-white" disabled={status!=='ready'||pending} onClick={()=>cancel(selected.id)}>Cancel run</button>{selected.cases?.map(item=><article key={item.id}><h3>{item.name||item.id}</h3><p>{item.status}</p><a href={`${path}/${selected.id}/cases/${item.id}/artifact`}>Open retained artifact</a></article>)}</Section>}
  {runs!==null&&<TrainingRunForm onCreate={create} disabled={status!=='ready'||pending}/>}</div>;
}
