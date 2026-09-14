import React, { useEffect, useState } from 'react';
import { nativeRequest } from '../transport';
export default function InsightsPage({ projectId }) {
 const [items,setItems]=useState([]),[cursor,setCursor]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async(after)=>{setBusy(true);setError('');try{const result=await nativeRequest(`/api/customer-context/${projectId}/insights${after?`?cursor=${encodeURIComponent(after)}`:''}`);setItems(previous=>after?[...previous,...result.data]:result.data);setCursor(result.nextCursor);}catch(e){setError(e.message);}finally{setBusy(false);}};
 useEffect(()=>{load();},[projectId]);
 return <>{error&&<p className="alert alert-danger" role="alert">{error}</p>}<div className="row">{items.map(item=><div className="col-lg-6" key={item.id}><article className="card"><div className="card-body"><h2 className="card-title">{item.title}</h2><p>{item.content}</p><small>{item.help_type}</small></div></article></div>)}</div>{cursor&&<button className="btn btn-white" disabled={busy} onClick={()=>load(cursor)}>Load more</button>}</>;
}
