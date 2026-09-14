import React, { useEffect, useState } from 'react';
import WidgetSettings from '../../dashboard/components/WidgetSettings';
import { Provider } from '../../dashboard/contexts/WidgetSettingsContext';
import { nativeRequest } from '../transport';
export default function WidgetSettingsPage({ projectId }) {
    const [data,setData]=useState(null),[error,setError]=useState('');
    useEffect(()=>{
        const script=document.createElement('script');script.src='/widget.js';
        window.h2h=window.h2h||function(){(window.h2hQueue=window.h2hQueue||[]).push([...arguments]);};
        const ready=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load widget preview'));});
        document.head.append(script);
        Promise.all([ready,nativeRequest(`/api/management/projects/${projectId}/widget-settings`)]).then(([,response])=>setData(response.data||response)).catch(e=>setError(e.message));
        return()=>script.remove();
    },[projectId]);
    if(error)return <p role="alert" className="alert alert-danger">{error}</p>;
    return data && <Provider settings={data.settings||data} previewAgent={data.previewAgent} previewBrand={data.previewBrand} installation={{widgetKey:data.widgetKey,scriptUrl:new URL('/widget.js',location.origin).href,apiOrigin:location.origin}} verificationSecret={data.verificationSecret}><WidgetSettings projectId={projectId}/></Provider>;
}
