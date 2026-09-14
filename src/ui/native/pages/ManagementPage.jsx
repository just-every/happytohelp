import React, { useEffect, useState } from 'react';
import AvatarUpload from './AvatarUpload';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';

const titles = { ais: 'AI', macros: 'Saved Replies', plugins: 'Integrations', agents: 'Agents', contacts: 'Contacts' };
export default function ManagementPage({ projectId, section, recordId }) {
    const path = `/api/management/projects/${projectId}/${section}`;
    const [items,setItems]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
    const load=()=>nativeRequest(path).then(r=>{const rows=r.data||r;setItems(rows);if(recordId && recordId!=='create')setDraft(rows.find(x=>x.id===recordId)||null);}).catch(e=>setError(e.message));
    useEffect(()=>{load();if(recordId==='create')setDraft(section==='agents'?{role:'operator'}:section==='ais'?{is_enabled:true}:{});},[path,recordId]);
    const change=(key,value)=>setDraft(d=>({...d,[key]:value}));
    const field=(name,label,type,options,required=false)=><Field key={name} {...{name,label,type,options,required}} value={draft[name]} onChange={change}/>;
    const save=async e=>{e.preventDefault();setBusy(true);setError('');try{await nativeRequest(path+(draft.id?`/${draft.id}`:''),{method:draft.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});setSaved(true);await load();}catch(e){setError(e.message);}finally{setBusy(false);}};
    const remove=async()=>{setBusy(true);setError('');try{await nativeRequest(`${path}/${draft.id}`,{method:'DELETE'});location.assign(`/projects/${projectId}/${section}`);}catch(e){setError(e.message);setBusy(false);}};
    return <><Feedback {...{error,saved}}/>{!draft && <><div className="d-flex justify-content-end mb-4"><a className="btn btn-primary" href={`/projects/${projectId}/${section}/create`}>{section==='agents'?'Invite agent':`Add ${titles[section]||section}`}</a></div><div className="card"><div className="table-responsive"><table className="table table-sm table-hover card-table"><thead><tr><th>{section==='macros'?'Title':'Name'}</th><th>{section==='agents'?'Role':section==='contacts'?'Email':'Details'}</th></tr></thead><tbody>{items?.map(item=><tr key={item.id}><td><a href={`/projects/${projectId}/${section}/${item.id}`}>{item.name||item.title||item.display_name||item.email}</a></td><td>{item.role||item.email||item.url||item.content}</td></tr>)}</tbody></table></div></div></>}
    {draft && <div className="workspace-settings"><form onSubmit={save}>
        {section==='ais' && <><Section title="Identity" description="Set the name, role, and avatar shown for this assistant."><div className="settings-grid">{field('name','Name',undefined,undefined,true)}{field('role','Role',undefined,undefined,true)}<AvatarUpload projectId={projectId} value={draft.avatar_url} onChange={value=>change('avatar_url',value)}/></div></Section><Section title="Behavior" description="Define how this assistant responds to conversations.">{field('model','Model',undefined,undefined,true)}{field('prompt','Prompt','textarea',undefined,true)}{field('is_animated','Animated','checkbox')}{field('is_enabled','Enabled','checkbox')}</Section></>}
        {section==='macros' && <Section title="Saved reply"><div className="settings-grid">{field('title','Title',undefined,undefined,true)}{field('content','Content','textarea',undefined,true)}</div></Section>}
        {section==='plugins' && <Section title="Integration">{field('name','Name',undefined,undefined,true)}{field('url','URL','url',undefined,true)}</Section>}
        {section==='agents' && <><Section title="Membership" description="Choose the role and email address for this invitation."><div className="settings-grid">{field('role','Role',undefined,[{value:'operator',label:'Agent'},{value:'admin',label:'Admin'},{value:'owner',label:'Owner'}],true)}{field('invitation_email','Email','email',undefined,true)}</div></Section><Section title="Notifications" description="Choose whether this agent is notified about unassigned conversation activity.">{field('is_notified_on_unassigned_activity','Notify on unassigned conversation activity','checkbox')}</Section></>}
        {section==='contacts' && <><Section title="Contact details"><div className="settings-grid">{field('name','Name')}{field('email','Email','email')}{field('phone','Phone')}{field('external_id','External ID')}</div></Section><Section title="Conversation access">{field('is_blocked','Block this contact','checkbox')}</Section></>}
        <div className="settings-actions"><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':section==='agents'&&!draft.id?'Invite':'Save'}</button>{draft.id && <button type="button" className="btn btn-outline-danger ms-2" disabled={busy} onClick={remove}>Delete</button>}</div>
    </form></div>}</>;
}
