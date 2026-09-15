import { useUnsavedChanges } from '../NavigationGuard';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { invalidateDashboardSession } from '../dashboard-state';
import React, { useEffect, useState } from 'react';
import {TimezoneField,SettingsTabs} from './ProjectControls';
import AvatarUpload from './AvatarUpload';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';
export default function AccountPage({projectId}) {
 const {markDirty,markSaved}=useUnsavedChanges();

    const router=useRouter(),navigate=useNavigate();

    const path='/api/management/profile';
    const [data,setData]=useState(null),[tab,setTab]=useState('general'),[error,setError]=useState(''),[saved,setSaved]=useState(false);
    useEffect(()=>{nativeRequest(path).then(r=>setData(r.data||r)).catch(e=>setError(e.message));},[]);
    const change=(key,value)=>{markDirty();setSaved(false);setData(d=>({...d,[key]:value}));};
    const field=(name,label,type)=><Field key={name} {...{name,label,type}} value={data[name]} onChange={change}/>;
    const submit=async e=>{e.preventDefault();setError('');try{
        if(tab==='security'&&data.password!==data.password_confirmation)throw new Error('Passwords do not match.');
        await nativeRequest(tab==='security'?'/api/identity/password':path,{method:tab==='security'?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(tab==='security'?{currentPassword:data.current_password,password:data.password}:data)});
        markSaved();if(tab==='security'){await invalidateDashboardSession(router);await navigate({to:'/login',replace:true});return;}setSaved(true);
    }catch(e){setError(e.message);}};
    if(!data)return <Feedback error={error}/>;
    return <div className="workspace-settings project-account"><Feedback {...{error,saved}}/><SettingsTabs tab={tab} onChange={setTab} tabs={[["general","General"],["notifications","Notification"],["security","Security"]]}/><form onSubmit={submit}>
        {tab==='general'&&<Section title="Profile"><div className="project-avatar">{!data.avatar_url&&<span className="project-avatar-placeholder">{data.name?.slice(0,1)}</span>}<AvatarUpload projectId={projectId} value={data.avatar_url} onChange={value=>change('avatar_url',value)}/></div>{field('name','Name')}{field('email','Email','email')}<TimezoneField value={data.timezone} onChange={change}/></Section>}
        {tab==='notifications'&&<Section title="Notifications">{field('is_notifiable_on_conversation_assignment','On conversation assigned','checkbox')}</Section>}
        {tab==='security'&&<Section title="Change your password">{field('current_password','Current password','password')}{field('password','New password','password')}{field('password_confirmation','Confirm password','password')}</Section>}
        <div className="settings-actions"><button className="btn btn-primary">Update</button></div>
    </form></div>;
}
