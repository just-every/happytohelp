import React,{useEffect,useState} from 'react';
import './connections/connections.css';
import {nativeRequest} from '../transport';
import Tokens from './connections/Tokens';
import Destinations from './connections/Destinations';
export default function Connections({projectId,section,role}){
 const kind=section==='api-settings'?'tokens':section==='webhook-settings'?'webhooks':section==='slack-settings'?'slack':'deliveries',root=`/api/management/projects/${projectId}/connections`;
 const [rows,setRows]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const allowed=['owner','admin'].includes(role);
 const load=async()=>{try{const result=await nativeRequest(root+'/'+kind);setRows(result.data);}catch(e){setError(e.message);}};
 useEffect(()=>{setRows([]);setError('');setNotice('');if(allowed)load();},[root,kind,allowed]);
 const act=async(path,method,body)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{const result=await nativeRequest(root+path,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});setNotice(path.endsWith('/test')?'Test recorded. Check the delivery log for its outcome.':'Saved.');await load();return result;}catch(e){setError(e.message);}finally{setBusy(false);}};
 if(!allowed)return <p role="alert">Only workspace owners and admins can manage connections.</p>;
 return <div className="workspace-settings connections-page" aria-busy={busy} style={{maxWidth:800,overflowWrap:'anywhere'}}>{error&&<p className="alert alert-danger" role="alert">{error}</p>}{notice&&<p className="alert alert-info" role="status">{notice}</p>}{kind==='tokens'?<Tokens rows={rows} act={act}/>:kind==='deliveries'?<><button className="btn btn-white mb-3" onClick={load}>Refresh delivery log</button>{!rows.length&&<p>No deliveries yet.</p>}{rows.map((row,index)=><article className="card mb-3" key={row.id+':'+index}><div className="card-body"><h3 className="h4">{row.name} · {row.event}</h3><p>{row.started_at||row.created_at}<br/>Status: {row.state}{row.status?` (HTTP ${row.status})`:''}<br/>Attempt: {row.number||'Not started'} · Duration: {row.duration_ms===null?'Pending':`${row.duration_ms} ms`}</p>{row.error_class&&<p>Error class: {row.error_class}</p>}</div></article>)}</>:<Destinations key={kind} kind={kind} rows={rows} act={act}/>}</div>;
}
