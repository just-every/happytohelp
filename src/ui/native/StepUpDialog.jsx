import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {trapDialogTab} from '../dashboard/components/dialogTabBoundary';
import {FactorProof} from '../identity/two-factor/parts';
import './pages/confirm-dialog.css';

/**
 * Exports, erasure, role and credential changes ask for a recent step-up. Any dashboard
 * request refused for one opens this dialog (transport.js); confirming retries it once.
 */
export default function StepUpHost() {
    const [request, setRequest] = useState(null);
    useEffect(() => {
        window.h2hStepUp = details => new Promise(resolve => setRequest({details, resolve}));
        return () => { delete window.h2hStepUp; };
    }, []);
    if (!request) return null;
    const finish = confirmed => { request.resolve(confirmed); setRequest(null); };
    return <StepUpDialog details={request.details} onDone={() => finish(true)} onCancel={() => finish(false)}/>;
}

function StepUpDialog({details, onDone, onCancel}) {
    const dialog = useRef(null), titleId = useId();
    const password = details.methods?.includes('password');
    useEffect(() => {
        const element = dialog.current, previous = document.activeElement;
        if (!element.open) element.showModal();
        return () => { if (element.open) element.close(); if (previous && previous !== document.body && previous.isConnected) previous.focus(); };
    }, []);
    return createPortal(<dialog ref={dialog} className="confirm-dialog step-up-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={trapDialogTab} onCancel={event => { event.preventDefault(); onCancel(); }}>
        <h2 id={titleId} className="confirm-dialog__title">Confirm it’s you</h2>
        <div className="confirm-dialog__body"><p>{password ? 'This action needs your password again.' : 'This action needs your second factor again.'} You won’t be asked again for 15 minutes.</p></div>
        <FactorProof look="dashboard" endpoint="/api/identity/step-up" password={password} submitLabel="Confirm" onDone={onDone}
            extra={<div className="confirm-dialog__actions"><button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button></div>}/>
    </dialog>, document.body);
}
