import React, { useState } from 'react';
import { useUnsavedChanges } from '../NavigationGuard';
import { nativeRequest } from '../transport';
import { Section } from './forms';

const outcomes = {
    approve: code => `Computer approved. Authorization code ${code} was accepted; the computer now continues setup on its own screen.`,
    deny: code => `Request denied. Authorization code ${code} was rejected and cannot be used again.`,
};

/** A code that is wrong, expired or already decided is reported by the server as unavailable (409). */
const failureMessage = error => error.status === 409
    ? 'This authorization code is not valid. It may have expired or already been used; check the code shown on your computer.'
    : error.message || 'The decision could not be saved. Try again.';

/** Approve or deny a computer's device code and show the recorded outcome. */
export default function LocalComputerAuthorize({ projectId, initialCode = '' }) {
    const { markDirty, markSaved } = useUnsavedChanges();
    const [code, setCode] = useState(initialCode);
    const [pending, setPending] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const decide = async event => {
        event.preventDefault();
        const decision = event.nativeEvent.submitter?.value;
        const userCode = code.trim();
        if (pending || !userCode || !outcomes[decision]) return;
        setPending(true);
        setError('');
        setResult(null);
        try {
            await nativeRequest(`/api/projects/${encodeURIComponent(projectId)}/local-agent-authorizations/decision`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_code: userCode, decision }),
            });
            markSaved();
            setCode('');
            setResult({ decision, message: outcomes[decision](userCode) });
        } catch (failure) {
            setError(failureMessage(failure));
        } finally {
            setPending(false);
        }
    };

    return <Section title="Authorize a computer" description="Enter the code shown by the computer you are connecting, then approve or deny it.">
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        {result && <div role="status" className={`alert ${result.decision === 'approve' ? 'alert-success' : 'alert-secondary'}`}>{result.message}</div>}
        <form onSubmit={decide}>
            <label className="form-label" htmlFor="user_code">Authorization code</label>
            <input id="user_code" name="user_code" className="form-control mb-3" required autoComplete="off" spellCheck={false}
                value={code} disabled={pending} onChange={event => { setCode(event.target.value); setResult(null); markDirty(); }}/>
            <button type="submit" name="decision" value="approve" className="btn btn-primary" disabled={pending || !code.trim()}>Approve</button>
            <button type="submit" name="decision" value="deny" className="btn btn-white ms-2" disabled={pending || !code.trim()}>Deny</button>
        </form>
    </Section>;
}
