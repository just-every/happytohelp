import React, {useEffect,useState} from 'react';
import {nativeRequest} from './transport';

/** The sign-in link opens a fresh session in this browser. The original action waits for mailbox proof. */
export default function EmailStepUp({accountId,onDone,onCancel,startImmediately=false}) {
    const [sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const send=async()=>{
        setBusy(true);setError('');
        try {await nativeRequest('/api/identity/step-up/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnTo:location.pathname+location.search})});setSent(true);}
        catch(failure){setError(failure.message);}finally{setBusy(false);}
    };
    useEffect(()=>{if(startImmediately)void send();},[]);
    const complete=async()=>{
        setBusy(true);setError('');
        try {
            const proof=await nativeRequest('/api/identity/two-factor');
            if(proof.userId!==accountId||!proof.stepUp)throw new Error('Open the email link in this browser and press Sign in before continuing.');
            onDone();
        }catch(failure){setError(failure.message);}finally{setBusy(false);}
    };
    return <div className="tf-step">
        {sent&&<p role="status">Check your inbox. Open the link in this browser and press Sign in, then return to this tab. The link expires in 15 minutes and works once.</p>}
        {error&&<p className="tf-problem" role="alert">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={sent?complete:send}>{busy?'Please wait…':sent?'Continue':'Email me a sign-in link'}</button>
        <div className="confirm-dialog__actions"><button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button></div>
    </div>;
}
