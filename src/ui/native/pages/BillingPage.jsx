import React, { useEffect, useRef, useState } from 'react';
import { nativeRequest } from '../transport';
import { Field, Section, Feedback } from './forms';
import './BillingPage.css';
export default function BillingPage({ projectId }) {
 const path=`/api/management/projects/${projectId}/billing`;
 const [data,setData]=useState(null),[error,setError]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[amount,setAmount]=useState(2000),[auto,setAuto]=useState({enabled:false,top_up_minor:2000,threshold_minor:1000});
 const [topUpOpen,setTopUpOpen]=useState(false),[autoOpen,setAutoOpen]=useState(false);
 const attempt=useRef(null);const [rate,setRate]=useState('');
 const saveRate=async()=>{try{await nativeRequest(`${path}/conversion`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({usd_conversion_rate:Number(rate)})});await load();}catch(e){setError(e.message);}};
 const load=()=>nativeRequest(path).then(value=>{setData(value);if(value.data)setAuto({enabled:Boolean(value.data.auto_top_up),top_up_minor:value.data.top_up_minor,threshold_minor:value.data.threshold_minor});}).catch(e=>setError(e.message));
 useEffect(()=>{load();},[path]);
 const currency=minor=>minor==null?'Not recorded':new Intl.NumberFormat('en',{style:'currency',currency:(data?.currency||'usd').toUpperCase()}).format(minor/100);
 const action=async kind=>{if(attempt.current)return;setError('');setBusy(true);const request_id=crypto.randomUUID();attempt.current={kind,request_id};try{const response=await nativeRequest(`${path}/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request_id,amount_minor:amount})});if(response.url){location.assign(response.url);return;}await load();if(response.status!=='uncertain')attempt.current=null;}catch(e){setError(e.message+' Refresh operation status before another payment attempt.');}finally{setBusy(false);}};
 const setCurrency=async value=>{setError('');try{await nativeRequest(`${path}/currency`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({currency:value})});await load();}catch(e){setError(e.message);}};
 const save=async e=>{e.preventDefault();setError('');try{await nativeRequest(`${path}/automated`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(auto)});setSaved(true);await load();}catch(e){setError(e.message);}};
 if(!data)return <Feedback error={error}/>;
 const paymentDisabled=!data.configured||busy||Boolean(attempt.current);
 const heading=label=><span className="billing-heading"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor"/><path d="M1 6.5h14" stroke="currentColor"/></svg>{label}</span>;
 return <div className="workspace-settings billing-page">
  <Feedback {...{error,saved}}/>
  <Section title={heading('Status')}>
   <div className="settings-summary"><div><div className="settings-note mb-1">Current balance</div><div className="settings-balance">{currency(data.balance?.amount_minor)}</div></div></div>
   <div className="settings-actions billing-status-actions"><button className="btn btn-primary" aria-expanded={topUpOpen} aria-controls="billing-top-up" onClick={()=>setTopUpOpen(!topUpOpen)}>Top up</button></div>
  </Section>
  <Section title={heading('Payment options')}>
   <div className="billing-payment-options">
    <div><h3>Automated payment</h3><p className="settings-note">Automatically top up when balance drops below certain amount.</p><button className="btn btn-primary" aria-expanded={autoOpen} aria-controls="billing-automated" onClick={()=>setAutoOpen(!autoOpen)}>Setup</button>
     {autoOpen&&<form id="billing-automated" className="billing-expanded" onSubmit={save}><Field name="enabled" label="Enable automatic top ups" type="checkbox" value={auto.enabled} onChange={(name,value)=>setAuto({...auto,[name]:value})}/><Field name="threshold_minor" label="When balance is below (cents)" type="number" value={auto.threshold_minor} onChange={(name,value)=>setAuto({...auto,[name]:value})}/><Field name="top_up_minor" label="Top up amount (cents)" type="number" value={auto.top_up_minor} onChange={(name,value)=>setAuto({...auto,[name]:value})}/><button className="btn btn-primary" disabled={!data.configured}>Save</button><button type="button" className="btn btn-white ms-2" disabled={paymentDisabled} onClick={()=>action('setup')}>Add payment method</button></form>}
    </div>
    <div><h3>One-time payment</h3><p className="settings-note">Make a one-time payment to manually top up your account balance as needed.</p><button className="btn btn-primary" aria-expanded={topUpOpen} aria-controls="billing-top-up" onClick={()=>setTopUpOpen(!topUpOpen)}>Make a payment</button>
     {topUpOpen&&<div id="billing-top-up" className="billing-expanded"><Field name="amount_minor" label="Amount" value={amount} options={data.amounts.map(value=>({value,label:currency(value)}))} onChange={(_,value)=>setAmount(Number(value))}/><button className="btn btn-primary" disabled={paymentDisabled} onClick={()=>action('top-up')}>Top up</button></div>}
    </div>
   </div>
   {!data.configured&&<p className="settings-note billing-provider-note">Payment provider is not configured.</p>}
  </Section>
  <details className="billing-details"><summary>Billing details and activity</summary><div className="billing-expanded">
   <Section title="Currency"><Field name="currency" label="Billing currency" value={data.currency} options={data.currencies||[]} onChange={(_,value)=>setCurrency(value)}/>{data.currency!=='usd'&&<div><Field name="usd_conversion_rate" label="Account currency units per US dollar" type="number" value={rate} onChange={(_,value)=>setRate(value)}/><button className="btn btn-white" disabled={!(Number(rate)>0)} onClick={saveRate}>Save conversion rate</button></div>}<p className="settings-note">Currency can be changed before financial activity begins.</p></Section>
   <Section title="Usage"><p>Daily usage: {currency(data.usage?.daily_usage_minor)}</p>{data.usage?.balance_exhaustion_at&&<p>Estimated balance exhaustion: {new Date(data.usage.balance_exhaustion_at).toLocaleDateString()}</p>}{Boolean(data.usage?.missing_usage_count)&&<p>Usage not yet recorded: {data.usage.missing_usage_count}</p>}{Boolean(data.usage?.pending_conversion_count)&&<p>Pending currency conversion: {data.usage.pending_conversion_count}</p>}</Section>
   <Section title="Payment history"><div className="billing-history"><table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Receipt</th></tr></thead><tbody>{data.charges.map(charge=><tr key={charge.id}><td>{charge.created_at}</td><td>{currency(charge.amount_minor)}</td><td>{charge.kind}</td><td>{(charge.receipt_url||charge.invoice_url)&&<a href={charge.receipt_url||charge.invoice_url}>View receipt</a>}</td></tr>)}</tbody></table></div></Section>
   <Section title="Payment operations"><button className="btn btn-white mb-3" onClick={load}>Refresh operation status</button><ul>{data.operations.map(operation=><li key={operation.id}>{operation.kind}: {operation.state||operation.status}</li>)}</ul><button className="btn btn-primary" disabled={paymentDisabled} onClick={()=>action('portal')}>Billing Portal</button></Section>
  </div></details>
 </div>;
}
