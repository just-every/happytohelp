import { useDashboardLocation } from '../dashboard-state';
import React, { useEffect, useState } from 'react';
import DelegationPairing from '../../dashboard/components/DelegationPairing';
import DelegationDeviceSettings from '../../dashboard/components/DelegationDeviceSettings';
import { nativeRequest } from '../transport';
import { Feedback, Section } from './forms';
import LocalComputerAuthorize from './LocalComputerAuthorize';
import '../setup-help/setup-help.css';
export default function ComputersPage({ projectId, projectName }) {
 const routeLocation=useDashboardLocation();

    const [devices,setDevices]=useState([]),[error,setError]=useState(''),[pairing,setPairing]=useState(null),[open,setOpen]=useState(false),[selected,setSelected]=useState(null);
    const path=`/api/projects/${projectId}/local-agents`;
    const load=()=>nativeRequest(path).then(r=>setDevices(r.data)).catch(e=>setError(e.message));
    useEffect(()=>{load();},[path]);
    const createPairing=async()=>{try{const response=await nativeRequest(`${path}/pairings`,{method:'POST'});setPairing(response.data);return response.data;}catch(e){setError(e.message);throw e;}};
    const revoke=async id=>{await nativeRequest(`${path}/${id}`,{method:'DELETE'});await load();};
    return <div className="workspace-settings"><Feedback error={error}/><Section title="Local computers" description="Connect your own computer to investigate and resolve delegated support work."><div className="sh-steps mb-3"><ol><li>On the computer, install Node.js 20 or later and the Codex CLI, signed in with <code>codex login</code>. Claude Code with an Anthropic API key works too.</li><li>Choose <b>Connect computer</b>, pick the app, name the computer and choose <b>Generate setup command</b>. The command holds a pairing code that works once, for 10 minutes.</li><li>Paste the command into a terminal on that computer and leave the window open. The computer appears here when it is ready.</li></ol><p className="sh-note">Every step, and how to stop or disconnect it: <a href="/docs/local-agent">Local agent guide</a>.</p></div><button className="btn btn-primary mb-3" onClick={()=>setOpen(true)}>Connect computer</button><div className="list-group">{devices.map(device=><button className="list-group-item list-group-item-action" key={device.id} onClick={()=>setSelected(device)}>{device.name}<span className="ms-3 text-muted">{device.status}</span></button>)}</div></Section>
        {selected&&<Section title={selected.name}><DelegationDeviceSettings device={selected} projectId={projectId} projectName={projectName} onSaved={load}/></Section>}
        <LocalComputerAuthorize projectId={projectId} projectName={projectName} initialCode={new URLSearchParams(routeLocation.searchStr).get('user_code')||''}/>
        <DelegationPairing {...{devices,error,pairing,projectId,createPairing}} isOpen={open} onHide={()=>setOpen(false)} onPairingExpired={()=>setPairing(null)} onRefresh={load} onRevoke={revoke} onWorkerReady={load}/>
    </div>;
}
