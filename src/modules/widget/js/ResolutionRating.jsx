import React, {useContext, useEffect, useState, useRef} from 'react';
import {ConnectContext} from './context/ConnectContext';

export default function ResolutionRating() {
    const form = useRef(null);
    const {resolution, setResolution, sendMessage} = useContext(ConnectContext);
    const [value, setValue] = useState(null), [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        setValue(resolution?.rating?.value ?? null);
        setComment(resolution?.rating?.comment || '');
        setError('');
    }, [resolution?.id, resolution?.rating?.revision]);
    useEffect(() => { if (resolution?.id) form.current?.scrollIntoView({block: 'nearest'}); }, [resolution?.id]);
    if (!resolution) return null;
    const save = async event => {
        event.preventDefault(); setSaving(true); setError('');
        try {
            const result = await sendMessage('rateResolution', {resolutionId: resolution.id, value, comment});
            setResolution(result.resolution);
        } catch (failure) { setError(failure.message || 'Could not save your rating. Try again.'); }
        finally { setSaving(false); }
    };
    const unchanged = value === resolution.rating?.value && comment === resolution.rating?.comment;
    return <form ref={form} className="happytohelp-resolution-rating" onSubmit={save} aria-label="Rate this conversation">
        <p><strong>Did this answer your question?</strong></p>
        <div className="happytohelp-rating-options">
            <button type="button" aria-pressed={value === 1} disabled={saving} onClick={() => setValue(1)}>👍 Yes</button>
            <button type="button" aria-pressed={value === -1} disabled={saving} onClick={() => setValue(-1)}>👎 No</button>
        </div>
        <label htmlFor="happytohelp-rating-comment">Comment (optional)</label>
        <textarea id="happytohelp-rating-comment" maxLength={1000} rows={2} value={comment} onChange={event => setComment(event.target.value)} disabled={saving}/>
        <span className="happytohelp-rating-count">{comment.length}/1,000</span>
        <button type="submit" disabled={saving || value === null || unchanged}>{saving ? 'Saving…' : resolution.rating ? 'Update rating' : 'Send rating'}</button>
        {resolution.rating && <p role="status">Thanks for your feedback. You can change it here.</p>}
        {error && <p role="alert">{error}</p>}
    </form>;
}
