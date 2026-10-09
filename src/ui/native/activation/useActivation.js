import {useCallback,useEffect,useRef,useState} from 'react';
import {nativeRequest} from '../transport';
const eventName='activation-snapshot';
export default function useActivation(projectId) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const current=useRef(projectId);current.current=projectId;
 const path=`/api/management/projects/${encodeURIComponent(projectId)}/activation`;
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError('');setBusy('');
  const receive=event=>{if(event.detail?.projectId===projectId)setData(event.detail);};
  window.addEventListener(eventName,receive);
  nativeRequest(path,{signal:controller.signal,cache:'no-store'}).then(result=>setData(result.data)).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return ()=>{controller.abort();window.removeEventListener(eventName,receive);};
 },[path,projectId]);
 const run=useCallback(async(step,testMail=false)=>{
  if(busy)return;setBusy(testMail?'test-mail':step||'all');setError('');
  try {
   const result=await nativeRequest(`${path}/${testMail?'test-mail':'check'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(step&&!testMail?{step}:{}),cache:'no-store'});
   if(current.current===projectId){setData(result.data);window.dispatchEvent(new CustomEvent(eventName,{detail:result.data}));}
  }catch(e){if(current.current===projectId)setError(e.message);}
  finally{if(current.current===projectId)setBusy('');}
 },[path,projectId,busy]);
 return {data,error,busy,check:step=>run(step),testMail:()=>run(null,true)};
}
