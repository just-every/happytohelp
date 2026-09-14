import React, { useEffect, useState } from 'react';
import BrandImage from './BrandImage';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';
export default function ProjectSettings({ projectId, section }) {
    const kind = section === 'edit' ? 'settings' : section;
    const path = `/api/management/projects/${projectId}/${kind}`;
    const [data,setData]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
    useEffect(()=>{nativeRequest(path).then(r=>setData(r.data || r)).catch(e=>setError(e.message));},[path]);
    const change=(key,value)=>{setSaved(false);setData(d=>({...d,[key]:value}));};
    const field=(name,label,type,options)=> <Field key={name} {...{name,label,type,options}} value={data[name]} onChange={change}/>;
    const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await nativeRequest(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}};
    if(!data)return <Feedback error={error}/>;
    return <div className="workspace-settings"><Feedback {...{error,saved}}/><form onSubmit={submit}>{kind==='email-settings' ? <><Section title="Receive Email"><p><strong>{data.email_to_address}</strong></p><p className="settings-note">Any email sent to this address will create a support conversation.</p><p className="settings-note">You can set up automatic forwarding to use another email address (such as support@yourdomain.com) for support.</p></Section><Section title="Send Email"><div className="settings-grid">{field('email_from_address','Support Email From Address','email')}{field('email_from_name','Support Email From Name')}</div></Section></> : <>
        <BrandImage projectId={projectId} name={data.name} value={data.brand_image_url} onChange={value=>change('brand_image_url',value)}/><div className="settings-columns"><div className="settings-column"><Section title="Project details"><div className="settings-grid">{field('name','Name')}{field('website','Website','url')}{field('timezone','Timezone')}</div></Section><Section title="Appearance"><div className="settings-grid">{field('primary_color','Workspace color','color')}{field('logo_url','Logo URL','url')}</div></Section></div><div className="settings-column"><Section title="Help Center">{field('help_center_domain','Custom Help Center URL')}</Section><Section title="Contact tracking">{field('is_contact_tracking_enabled','Track contact page views with widget','checkbox')}</Section><Section title="Availability">{field('is_available','Accept new conversations','checkbox')}{field('unavailable_message','Away message','textarea')}</Section></div></div>
    </>}<div className="settings-actions"><button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save'}</button></div></form></div>;
}
