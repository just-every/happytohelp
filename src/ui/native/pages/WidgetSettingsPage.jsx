import React, { useEffect, useState } from 'react';
import WidgetSettings from '../../dashboard/components/WidgetSettings';
import { Provider } from '../../dashboard/contexts/WidgetSettingsContext';
import { nativeRequest } from '../transport';
export default function WidgetSettingsPage({ projectId }) {
    const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
    useEffect(()=>{
        let active=true;setError('');setData(null);
        const script=document.createElement('script');script.src='/widget.js';
        window.h2h=window.h2h||function(){(window.h2hQueue=window.h2hQueue||[]).push([...arguments]);};
        const ready=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load widget preview'));});
        document.head.append(script);
        Promise.all([ready,nativeRequest(`/api/management/projects/${projectId}/widget-settings`)]).then(([,response])=>{if(active)setData(response.data||response)}).catch(e=>{if(active)setError(e.message)});
        return()=>{active=false;script.remove();};
    },[projectId,attempt]);
    if(error)return <div role="alert" className="widget-settings-load-error"><p>Widget settings could not load. {error}</p><button type="button" className="btn btn-outline-dark" onClick={()=>setAttempt(value=>value+1)}>Try again</button></div>;
    if(!data)return <p role="status">Loading your widget settings and preview…</p>;
    return data && <Provider settings={data.settings||data} previewAgent={data.previewAgent} previewBrand={data.previewBrand} installation={{widgetKey:data.widgetKey,scriptUrl:new URL('/widget.js',location.origin).href,apiOrigin:location.origin}} verificationSecret={data.verificationSecret}><WidgetSettings projectId={projectId}/></Provider>;
}
