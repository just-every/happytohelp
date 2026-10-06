import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useNavigationGuard } from '../NavigationGuard';
import { nativeRequest } from '../transport';
import { clearDemoReturn, readDemoReturn, realWorkspaces, returnWorkspace } from './return-workspace';
import './demo-banner.css';

export default function DemoWorkspaceBanner({ settings }) {
    const active = !settings.isGlobalInbox && !settings.projectUnavailable && settings.project?.is_demo;
    return active ? <DemoReturn key={`${settings.currentAgent.id}:${settings.project.id}`} settings={settings} /> : null;
}

function DemoReturn({ settings }) {
    const navigate = useNavigate();
    const { confirmNavigation } = useNavigationGuard();
    const banner = useRef(null), pending = useRef(false);
    const [context, setContext] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false), [loading, setLoading] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        let saved;
        try { saved = readDemoReturn(window.localStorage, settings.currentAgent.id, settings.project.id); } catch { saved = null; }
        setContext(saved);
        nativeRequest('/api/management/bootstrap', { signal: controller.signal }).then(fresh => {
            if (fresh.currentAgent?.id !== settings.currentAgent.id) throw new Error('Your signed-in account changed. Reload this page before returning.');
            setProjects(realWorkspaces(fresh));
            if (saved && !returnWorkspace(fresh, saved)) setError('Your original workspace is no longer available. Choose another workspace below.');
            setReady(true);
        }).catch(failure => { if (!controller.signal.aborted) setError(failure.message || 'Could not check your workspaces. Reload and try again.'); });
        return () => controller.abort();
    }, [settings.currentAgent.id, settings.project.id]);
    useEffect(() => {
        const element = banner.current, main = element.closest('#workspace-main');
        const resize = () => main?.style.setProperty('--demo-banner-height', `${element.getBoundingClientRect().height}px`);
        const observer = new ResizeObserver(resize);
        observer.observe(element); resize();
        return () => { observer.disconnect(); main?.style.removeProperty('--demo-banner-height'); };
    }, []);
    const original = projects.find(project => project.id === context?.projectId);
    const destination = original?.id || selected;
    const back = async () => {
        if (pending.current || !destination || !await confirmNavigation()) return;
        pending.current = true; setLoading(true); setError('');
        try {
            const fresh = await nativeRequest('/api/management/bootstrap');
            if (fresh.currentAgent?.id !== settings.currentAgent.id) throw new Error('Your signed-in account changed. Reload this page before returning.');
            setProjects(realWorkspaces(fresh));
            if (!returnWorkspace(fresh, { userId: settings.currentAgent.id, projectId: destination })) {
                setSelected('');
                throw new Error('That workspace is no longer available. Choose another workspace below.');
            }
            await nativeRequest('/api/identity/switch-project', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: destination }),
            });
            await navigate({ to: `/projects/${destination}/conversations`, ignoreBlocker: true });
            clearDemoReturn(window.localStorage, settings.currentAgent.id);
        } catch (failure) { setError(failure.message || 'Could not return to your workspace. Try again.'); }
        finally { pending.current = false; setLoading(false); }
    };
    return <section ref={banner} className="demo-workspace-banner" aria-label="Demo workspace">
        <div className="demo-workspace-banner__copy"><strong>You are in the demo workspace</strong><span>Customers, conversations and FAQs are fictional.</span></div>
        <div className="demo-workspace-banner__return">
            {original ? <span>Return to {original.name}</span> : ready && projects.length > 0 ? <label>Return workspace<select value={selected} onChange={event => setSelected(event.target.value)} disabled={loading}><option value="">Choose your workspace</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : <span>{ready ? 'No other workspace is available to your account.' : 'Checking your workspaces…'}</span>}
            <button type="button" className="btn btn-sm btn-primary" onClick={back} disabled={!ready || !destination || loading}>{loading ? 'Returning…' : 'Back to your workspace'}</button>
        </div>
        {error && <p className="demo-workspace-banner__error" role="alert">{error}</p>}
    </section>;
}
