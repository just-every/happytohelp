import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './confirm-dialog.css';

/**
 * Modal confirmation shared by every destructive action. It is a native modal dialog, so the page behind it is inert,
 * focus stays inside, Escape cancels, and focus returns to the control that opened it. Cancel never touches data.
 * `confirmText` adds an exact type-to-confirm step for irreversible actions; a null `confirmLabel` makes the dialog
 * informational (the action is blocked and only Close is offered).
 */
export function ConfirmDialog({title, children, confirmLabel = 'Delete', busyLabel = 'Deleting…', cancelLabel, confirmText, busy = false, error = '', onConfirm, onCancel}) {
    const dialog = useRef(null), [typed, setTyped] = useState('');
    const titleId = useId(), bodyId = useId(), inputId = useId();
    const blocked = confirmLabel === null, ready = !confirmText || typed === confirmText;
    useEffect(() => {
        const element = dialog.current, previous = document.activeElement;
        if (!element.open) element.showModal();
        return () => {
            if (element.open) element.close();
            if (previous && previous !== document.body && previous.isConnected) previous.focus();
        };
    }, []);
    const confirm = () => { if (!busy && ready && !blocked) onConfirm(); };
    return createPortal(<dialog ref={dialog} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
        <h2 id={titleId} className="confirm-dialog__title">{title}</h2>
        <div id={bodyId} className="confirm-dialog__body">{children}</div>
        {confirmText && <div className="form-group"><label htmlFor={inputId} className="form-label">Type {confirmText} to confirm</label><input id={inputId} className="form-control" autoComplete="off" value={typed} disabled={busy} onChange={event => setTyped(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); confirm(); } }}/></div>}
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="confirm-dialog__actions">
            <button type="button" className="btn btn-outline-secondary confirm-dialog__cancel" disabled={busy} onClick={onCancel}>{cancelLabel || (blocked ? 'Close' : 'Cancel')}</button>
            {!blocked && <button type="button" className="btn btn-danger confirm-dialog__confirm" disabled={busy || !ready} onClick={confirm}>{busy ? busyLabel : confirmLabel}</button>}
        </div>
    </dialog>, document.body);
}

/**
 * `ask({title, body, run, ...})` opens the dialog; `run` performs the action while the dialog stays open and shows any
 * error inside it. Render the returned `dialog` once in the page.
 */
export function useConfirmation() {
    const [pending, setPending] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const ask = useCallback(options => { setError(''); setBusy(false); setPending(options); }, []);
    const cancel = useCallback(() => { setPending(null); setError(''); }, []);
    const confirm = async () => {
        setBusy(true); setError('');
        try { await pending.run(); if (alive.current) setPending(null); }
        catch (failure) { if (alive.current) setError(failure.message); }
        finally { if (alive.current) setBusy(false); }
    };
    const dialog = pending && <ConfirmDialog title={pending.title} confirmLabel={pending.confirmLabel} busyLabel={pending.busyLabel} confirmText={pending.confirmText} busy={busy} error={error} onConfirm={confirm} onCancel={cancel}>{pending.body}</ConfirmDialog>;
    return {ask, dialog};
}
