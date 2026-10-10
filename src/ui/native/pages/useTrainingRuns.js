import { useEffect, useRef, useState } from 'react';
import { nativeRequest } from '../transport';

/** Only the current page/request may publish a result. Mutations require a loaded list. */
export default function useTrainingRuns(path, markSaved) {
    const current = useRef({ active: true, list: 0, detail: 0, ready: false, pending: false });
    const [runs, setRuns] = useState(null), [status, setStatus] = useState('loading');
    const [error, setError] = useState(''), [created, setCreated] = useState(false);
    const [selected, setSelected] = useState(null), [pending, setPending] = useState(false);
    const load = async () => {
        const scope = current.current;
        if (!scope.active) return;
        const version = ++scope.list;
        scope.ready = false; setStatus('loading'); setError('');
        try {
            const result = await nativeRequest(path);
            if (!scope.active || version !== scope.list) return;
            const rows = result.data ?? result.runs ?? result;
            if (!Array.isArray(rows)) throw new Error('The run list response was invalid.');
            setRuns(rows); setStatus('ready'); scope.ready = true;
        } catch (failure) {
            if (!scope.active || version !== scope.list) return;
            setError(failure.message); setStatus('error');
        }
    };
    useEffect(() => {
        current.current.active = true;
        load();
        return () => { current.current.active = false; ++current.current.list; ++current.current.detail; };
    }, [path]);
    const inspect = async id => {
        const scope = current.current;
        if (!scope.active) return;
        const version = ++scope.detail;
        try {
            const result = await nativeRequest(`${path}/${id}`);
            if (scope.active && version === scope.detail) setSelected(result.data ?? result);
        } catch (failure) {
            if (scope.active && version === scope.detail) setError(failure.message);
        }
    };
    const mutate = async work => {
        const scope = current.current;
        if (!scope.active || !scope.ready || scope.pending) return;
        scope.pending = true; ++scope.list; ++scope.detail; setPending(true); setError('');
        try { await work(scope); }
        finally { if (scope.active) { scope.pending = false; setPending(false); } }
    };
    const create = value => mutate(async scope => {
        setCreated(false);
        try {
            await nativeRequest(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...value, request_id: crypto.randomUUID()})});
        } catch (failure) { if (scope.active) throw failure; return; }
        if (!scope.active) return;
        markSaved(); setCreated(true); await load();
    });
    const cancel = id => mutate(async scope => {
        try {
            await nativeRequest(`${path}/${id}/cancel`, {method: 'POST'});
            if (!scope.active) return;
            await inspect(id);
            if (scope.active) await load();
        } catch (failure) { if (scope.active) setError(failure.message); }
    });
    return {runs, status, error, created, selected, pending, load, create, inspect, cancel};
}
