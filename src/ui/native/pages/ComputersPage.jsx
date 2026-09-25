import { useDashboardLocation } from '../dashboard-state';
import { useUnsavedChanges } from '../NavigationGuard';
import React, { useEffect, useState } from 'react';
import DelegationPairing from '../../dashboard/components/DelegationPairing';
import DelegationDeviceSettings from '../../dashboard/components/DelegationDeviceSettings';
import { nativeRequest } from '../transport';
import { Feedback, Section, Field } from './forms';
export default function ComputersPage({ projectId, projectName }) {
 const {markDirty,markSaved}=useUnsavedChanges();

 const routeLocation=useDashboardLocation();

    const [devices,setDevices]=useState([]),[error,setError]=useState(''),[pairing,setPairing]=useState(null),[open,setOpen]=useState(false),[selected,setSelected]=useState(null),[decision,setDecision]=useState('');
    const path=`/api/projects/${projectId}/local-agents`;
    const load=()=>nativeRequest(path).then(r=>setDevices(r.data)).catch(e=>setError(e.message));
    useEffect(()=>{load();},[path]);
    const createPairing=async()=>{try{const response=await nativeRequest(`${path}/pairings`,{method:'POST'});setPairing(response.data);return response.data;}catch(e){setError(e.message);throw e;}};
    const revoke=async id=>{await nativeRequest(`${path}/${id}`,{method:'DELETE'});await load();};
    const authorize=async e=>{e.preventDefault();try{await nativeRequest(`/api/projects/${projectId}/local-agent-authorizations/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_code:new FormData(e.currentTarget).get('user_code'),decision})});markSaved();setDecision('');}catch(e){setError(e.message);}};
    return <div className="workspace-settings"><Feedback error={error}/><Section title="Local computers" description="Connect your own computer to investigate and resolve delegated support work."><button className="btn btn-primary mb-3" onClick={()=>setOpen(true)}>Connect computer</button><div className="list-group">{devices.map(device=><button className="list-group-item list-group-item-action" key={device.id} onClick={()=>setSelected(device)}>{device.name}<span className="ms-3 text-muted">{device.status}</span></button>)}</div></Section>
        {selected&&<Section title={selected.name}><DelegationDeviceSettings device={selected} projectId={projectId} projectName={projectName} onSaved={load}/></Section>}
        <Section title="Authorize a computer"><form onSubmit={authorize}><label className="form-label" htmlFor="user_code">Authorization code</label><input id="user_code" name="user_code" onChange={markDirty} className="form-control mb-3" required defaultValue={new URLSearchParams(routeLocation.searchStr).get('user_code')||''}/><button className="btn btn-primary" onClick={()=>setDecision('approve')}>Approve</button><button className="btn btn-white ms-2" onClick={()=>setDecision('deny')}>Deny</button></form></Section>
        <DelegationPairing {...{devices,error,pairing,projectId,createPairing}} isOpen={open} onHide={()=>setOpen(false)} onPairingExpired={()=>setPairing(null)} onRefresh={load} onRevoke={revoke} onWorkerReady={load}/>
    </div>;
}
