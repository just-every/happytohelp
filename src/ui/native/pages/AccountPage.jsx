import React, { useEffect, useState } from 'react';
import AvatarUpload from './AvatarUpload';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';
export default function AccountPage({projectId}) {
    const path='/api/management/profile';
    const [data,setData]=useState(null),[tab,setTab]=useState('general'),[error,setError]=useState(''),[saved,setSaved]=useState(false);
    useEffect(()=>{nativeRequest(path).then(r=>setData(r.data||r)).catch(e=>setError(e.message));},[]);
    const change=(key,value)=>{setSaved(false);setData(d=>({...d,[key]:value}));};
    const field=(name,label,type)=><Field key={name} {...{name,label,type}} value={data[name]} onChange={change}/>;
    const submit=async e=>{e.preventDefault();setError('');try{
        if(tab==='security'&&data.password!==data.password_confirmation)throw new Error('Passwords do not match.');
        await nativeRequest(tab==='security'?'/api/identity/password':path,{method:tab==='security'?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(tab==='security'?{currentPassword:data.current_password,password:data.password}:data)});
        if(tab==='security'){location.assign('/login');return;}setSaved(true);
    }catch(e){setError(e.message);}};
    if(!data)return <Feedback error={error}/>;
    return <div className="workspace-settings"><Feedback {...{error,saved}}/><ul className="nav nav-tabs nav-overflow header-tabs">{[['general','General'],['notifications','Notification'],['security','Security']].map(([id,label])=><li className="nav-item" key={id}><button className={`nav-link ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{label}</button></li>)}</ul><form onSubmit={submit}>
        {tab==='general'&&<Section title="Profile"><AvatarUpload projectId={projectId} value={data.avatar_url} onChange={value=>change('avatar_url',value)}/>{field('name','Name')}{field('email','Email','email')}{field('timezone','Timezone')}</Section>}
        {tab==='notifications'&&<Section title="Notifications">{field('is_notifiable_on_conversation_assignment','On conversation assigned','checkbox')}</Section>}
        {tab==='security'&&<Section title="Change your password">{field('current_password','Current password','password')}{field('password','New password','password')}{field('password_confirmation','Confirm password','password')}</Section>}
        <div className="settings-actions"><button className="btn btn-primary">Update</button></div>
    </form></div>;
}
