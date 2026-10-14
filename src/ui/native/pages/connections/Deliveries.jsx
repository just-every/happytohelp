import React,{useState} from 'react';

export default function Deliveries({rows,act,load,busy}){
 const [confirm,setConfirm]=useState(null);
 const deliveries=Object.values(rows.reduce((all,row)=>{
  (all[row.id]??={...row,history:[]}).history.push(row);
  return all;
 },{}));
 return <>
  <button className="btn btn-white mb-3" disabled={busy} onClick={()=>{setConfirm(null);load();}}>Refresh delivery log</button>
  {!deliveries.length&&<p>No deliveries yet.</p>}
  {deliveries.map(row=><article className="card mb-3" key={row.id}>
   <div className="card-body">
    <h3 className="h4">{row.name} · {row.event}</h3>
    <p>Status: {row.state}</p>
    {row.history.map((attempt,index)=><div key={attempt.number||index}>
     <p>{attempt.started_at||attempt.created_at}<br/>
      Attempt: {attempt.number||'Not started'}{attempt.status?` (HTTP ${attempt.status})`:''} · Duration: {attempt.duration_ms===null?'Pending':`${attempt.duration_ms} ms`}
     </p>
     {attempt.error_class&&<p>Error class: {attempt.error_class}</p>}
    </div>)}
    {row.state==='uncertain'&&row.kind==='webhook'&&(confirm===row.id?<div>
     <p role="alert">The receiver may already have applied this webhook. Resending can duplicate its effects. Check the receiver first; the same delivery ID and exact body will be sent again.</p>
     <button className="btn btn-primary mr-2" disabled={busy} onClick={async()=>{
      await act('/deliveries/'+row.id+'/resend','POST',{attempt:row.attempts});setConfirm(null);
     }}>Resend despite duplicate risk</button>
     <button className="btn btn-white" disabled={busy} onClick={()=>setConfirm(null)}>Cancel resend</button>
    </div>:<button className="btn btn-white" disabled={busy} onClick={()=>setConfirm(row.id)}>Resend uncertain webhook</button>)}
   </div>
  </article>)}
 </>;
}
