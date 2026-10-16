import { useUnsavedChanges } from '../NavigationGuard';
import React, { useEffect,useState } from 'react';
import { nativeRequest } from '../transport';
import { Section, Feedback,Field } from './forms';
import GitHubOAuthSteps from './GitHubOAuthSteps';
export default function GitHubSettings({ projectId }) {
 const {markDirty,markSaved}=useUnsavedChanges();
 const path=`/api/management/projects/${projectId}/github`;
 const [error,setError]=useState(''),[data,setData]=useState(null),[repositories,setRepositories]=useState(null),[saved,setSaved]=useState(false),[connected,setConnected]=useState(false),[setup,setSetup]=useState(null);
 const load=()=>nativeRequest(path).then(r=>{setData(r.data||{repositories:[],allow_agents:false,allow_contacts:false});setConnected(r.configured);setSetup({oauth:r.oauth,installation:r.installation});}).catch(e=>setError(e.message));
 useEffect(()=>{load();},[path]);
 const connect=async()=>{setError('');try{const result=await nativeRequest(`${path}/connect`,{method:'POST'});if(!result.url)throw new Error('GitHub authorization URL unavailable');location.assign(result.url);}catch(error){setError(error.message);}};
 const disconnect=async()=>{try{await nativeRequest(path,{method:'DELETE'});markSaved();await load();setRepositories(null);}catch(error){setError(error.message);}};
 const discover=async()=>{try{const result=await nativeRequest(`${path}/repositories`);setRepositories(result.data);}catch(e){setError(e.message);}};
 const save=async e=>{e.preventDefault();try{await nativeRequest(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});markSaved();setSaved(true);}catch(e){setError(e.message);}};
 const change=(key,value)=>{markDirty();setSaved(false);setData(d=>({...d,[key]:value}));};
 return <div className="workspace-settings"><Feedback {...{error,saved}}/><Section title="GitHub Connection"><p>Connect a GitHub account so your team and the AI can read and search the repositories you choose, to answer questions about your code.</p>{setup&&!setup.oauth.ready&&!connected&&<GitHubOAuthSteps {...setup}/>}<div className="settings-actions"><button className="btn btn-primary" onClick={connect} disabled={Boolean(setup&&!setup.oauth.ready)}>Connect GitHub</button>{connected&&<button className="btn btn-outline-danger" onClick={disconnect}>Disconnect</button>}</div></Section>{data&&connected&&<form onSubmit={save}><Section title="Repositories"><button type="button" className="btn btn-white mb-3" onClick={discover}>Load repositories</button>{repositories?.map(repository=><Field key={repository.id} name={`repo-${repository.id}`} label={repository.full_name} type="checkbox" value={data.repositories?.includes(repository.full_name)} onChange={(_,checked)=>change('repositories',checked?[...new Set([...(data.repositories||[]),repository.full_name])]:(data.repositories||[]).filter(name=>name!==repository.full_name))}/>)}{!repositories&&<ul>{data.repositories?.map(name=><li key={name}>{name}</li>)}</ul>}</Section><Section title="Access"><Field name="allow_agents" label="Allow agents" type="checkbox" value={data.allow_agents} onChange={change}/><Field name="allow_contacts" label="Allow contacts" type="checkbox" value={data.allow_contacts} onChange={change}/></Section><button className="btn btn-primary">Save</button></form>}</div>;
}
