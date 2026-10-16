import React, {useContext, useState} from 'react';
import {ConnectContext} from './context/ConnectContext';

export default function MonitoringConsent() {
    const {monitoring, setMonitoringConsent} = useContext(ConnectContext);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (!monitoring?.available) return null;
    const choose = async consent => {
        setBusy(true); setError('');
        try { await setMonitoringConsent(consent); }
        catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
    };
    return <div className="happytohelp-monitoring-consent">
        {monitoring.consent !== true ? <><p>Share your page activity with our AI assistant for help before you ask? This includes pages, clicks and form interactions, with sensitive values removed.</p><button type="button" disabled={busy} onClick={() => choose(true)}>Allow proactive help</button><button type="button" disabled={busy} onClick={() => choose(false)}>No thanks</button></> : <><span>{monitoring.consent ? 'Page activity sharing is on.' : 'Page activity sharing is off.'}</span> <button type="button" disabled={busy} onClick={() => choose(!monitoring.consent)}>{monitoring.consent ? 'Stop sharing activity' : 'Allow proactive help'}</button></>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
