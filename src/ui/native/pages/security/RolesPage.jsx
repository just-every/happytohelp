import React,{useEffect,useState} from 'react';
import {nativeRequest} from '../../transport';
import {Feedback,Section} from '../forms';
import {useConfirmation} from '../ConfirmDialog';
import '../stack-table.css';
import './security.css';

const BASES=[['operator','Agent'],['collaborator','Collaborator'],['admin','Admin']];
const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const blank={name:'',base:'operator',permissions:null};

/** Settings → Roles: what each built-in role may do, and custom roles that narrow one of them. */
export default function RolesPage({projectId,role}){
 const {ask,dialog}=useConfirmation(),path=`/api/management/projects/${projectId}/roles`;
 const [data,setData]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{try{setData((await nativeRequest(path)).data)}catch(e){setError(e.message)}};
 useEffect(()=>{if(['owner','admin'].includes(role))load();},[path,role]);
 if(!['owner','admin'].includes(role))return <p role="alert">Only workspace owners and admins can manage roles.</p>;
 if(!data)return <Feedback error={error}/>;
 const label=key=>data.permissions.find(item=>item.key===key)?.label||key;
 const allowed=base=>data.builtIn.find(item=>item.key===base).permissions;
 const edit=item=>{setNotice('');setError('');setDraft(item?{...item}:{...blank,permissions:allowed('operator')})};
 const save=async event=>{event.preventDefault();setBusy(true);setError('');try{await nativeRequest(draft.id?`${path}/${draft.id}`:path,json(draft.id?'PUT':'POST',{name:draft.name,base:draft.base,permissions:draft.permissions}));setNotice(draft.id?'Role saved.':'Role created. Give it to a teammate on the Agents page.');setDraft(null);await load();}catch(e){setError(e.message)}setBusy(false)};
 const remove=item=>ask({title:`Delete the role “${item.name}”?`,body:<p>{item.members?'Move its members to another role first.':'No one holds this role. It is removed for good.'}</p>,confirmLabel:item.members?null:'Delete',run:async()=>{await nativeRequest(`${path}/${item.id}`,{method:'DELETE'});setNotice('Role deleted.');await load();}});
 const toggle=(key,on)=>setDraft({...draft,permissions:on?[...draft.permissions,key]:draft.permissions.filter(item=>item!==key)});
 return <div className="workspace-settings roles-page" aria-busy={busy}>
  <Feedback error={error}/>{notice&&<div role="status" className="alert alert-success">{notice}</div>}
  <Section title="Built-in roles" description="Owners and admins can do everything; only owners manage owners, admins, the two-factor policy and legal holds. A collaborator sees permitted conversations, adds internal notes and follows them, and cannot reply to customers or change anything else.">
   <div className="roles-grid">{data.builtIn.map(item=><article key={item.key} className="roles-card"><h3>{item.name}</h3><ul>{item.permissions.map(key=><li key={key}>{label(key)}</li>)}</ul></article>)}</div>
  </Section>
  <Section title="Custom roles" description="A custom role starts from Agent, Collaborator or Admin and leaves out what that teammate should not do. Changes apply on their next click; changing roles asks you to confirm it is you.">
   {data.custom.length===0&&!draft&&<p className="settings-note">No custom roles yet.</p>}
   {data.custom.length>0&&<div className="roles-grid">{data.custom.map(item=><article key={item.id} className="roles-card"><h3>{item.name}</h3><p className="text-muted">Based on {BASES.find(([key])=>key===item.base)?.[1]} · {item.members} member{item.members===1?'':'s'}</p><ul>{item.permissions.map(key=><li key={key}>{label(key)}</li>)}</ul>
    <div className="row-actions-inline"><button type="button" onClick={()=>edit(item)}>Edit</button><button type="button" onClick={()=>remove(item)}>Delete</button></div></article>)}</div>}
   {!draft&&<button type="button" className="btn btn-primary" onClick={()=>edit(null)}>New role</button>}
   {draft&&<form className="roles-form" onSubmit={save}>
    <div className="form-group"><label className="form-label" htmlFor="role-name">Name</label><input id="role-name" className="form-control" required maxLength={60} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></div>
    <div className="form-group"><label className="form-label" htmlFor="role-base">Based on</label><select id="role-base" className="form-select" value={draft.base} disabled={Boolean(draft.id)} onChange={event=>setDraft({...draft,base:event.target.value,permissions:allowed(event.target.value)})}>{BASES.filter(([key])=>key!=='admin'||role==='owner').map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></div>
    <fieldset><legend className="form-label">This role may</legend>{allowed(draft.base).map(key=><div className="form-check" key={key}><input className="form-check-input" type="checkbox" id={`perm-${key}`} checked={draft.permissions.includes(key)} onChange={event=>toggle(key,event.target.checked)}/><label className="form-check-label" htmlFor={`perm-${key}`}>{label(key)}</label></div>)}</fieldset>
    <div className="settings-actions"><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':draft.id?'Save role':'Create role'}</button><button type="button" className="btn btn-link" onClick={()=>setDraft(null)}>Cancel</button></div>
   </form>}
  </Section>
  {dialog}</div>;
}
