import { nativeRequest } from './transport';
import AdminNavigation from './AdminNavigation';
import React, { useEffect, useRef, useState } from 'react';

function AccountMenu({ agent, desktop = false }) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const menu = useRef(null);
    useEffect(()=>{const close=e=>{if(e.type==='keydown' ? e.key==='Escape' : !menu.current?.contains(e.target))setOpen(false);};document.addEventListener('click',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('click',close);document.removeEventListener('keydown',close);};},[]);
    return <div ref={menu} className={`navbar-account-menu ${desktop ? 'dropup' : ''}`}>
        <button type="button" className="native-profile-toggle" aria-label="Account menu" aria-expanded={open} onClick={()=>setOpen(!open)}>
            <span className="native-profile-avatar">{agent.avatar_url ? <img src={agent.avatar_url} alt=""/> : agent.name?.slice(0,1)}<span className="native-profile-status"/></span>
            {desktop && <><span className="navbar-profile-name">{agent.name}</span><i className="fe fe-chevron-up" aria-hidden="true"/></>}
        </button>
        {open && <div className="dropdown-menu show native-account-dropdown"><a className="dropdown-item" href="/users/profile">Profile</a><a className="dropdown-item" href="/admin">Admin</a><button className="dropdown-item" onClick={async()=>{try {setError('');await nativeRequest('/api/identity/session',{method:'DELETE'});location.assign('/login');} catch(failure) {setError(failure.message);}}}>Sign out</button>{error && <p className="px-3 mb-1 text-danger" role="alert">{error}</p>}</div>}
    </div>;
}

export default function Navigation({ settings }) {
    const pathname = location.pathname;
    const [open, setOpen] = useState(false);
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const [settingsOpen,setSettingsOpen] = useState(!pathname.includes('conversations'));
    const nav = useRef(null);
    useEffect(()=>{const close = e=>{if(e.key==='Escape'){setOpen(false);setWorkspaceOpen(false);}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[]);
    useEffect(()=>{const close=e=>{if(nav.current && !nav.current.contains(e.target))setWorkspaceOpen(false);};document.addEventListener('click',close);return()=>document.removeEventListener('click',close);},[]);
    const project = settings.project?.id || Object.keys(settings.projects || {})[0];
    const base = project ? `/projects/${project}` : '';
    const workspaceName = settings.isGlobalInbox ? 'Global Inbox' : settings.project?.name;
    const brand = !settings.isGlobalInbox && (settings.project?.brand_image_url || settings.project?.avatar_url);
    const links = [['Project','edit'],['Billing','billing'],['AI','ais'],['Training','datasets'],['Agents','agents'],['Email','email-settings'],['Widget','widget-settings'],['Saved Replies','macros']];
    const extraLinks = [['Knowledge','articles'],['Categories','categories'],['Local computers','local-agent'],['Integrations','plugins'],['GitHub','github-settings']];
    const active = path => pathname === path || pathname.startsWith(`${path}/`);
    const switchWorkspace = async id=>{if(id)await nativeRequest('/api/identity/switch-project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id})});location.assign(id?`/projects/${id}/conversations`:'/conversations');};
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return <AdminNavigation agent={settings.currentAgent} AccountMenu={AccountMenu}/>;
    return <nav ref={nav} className="navbar navbar-vertical fixed-left navbar-expand-xl navbar-light navbar-refined native-shell" id="sidebar" aria-label="Main navigation"><div className="container-fluid">
        <button className="navbar-toggler" type="button" aria-controls="sidebarCollapse" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}><span className="navbar-toggler-icon" /></button>
        <div className="navbar-workspace"><button className="navbar-workspace-toggle" type="button" aria-label={`Switch workspace: ${workspaceName}`} aria-expanded={workspaceOpen} onClick={()=>setWorkspaceOpen(!workspaceOpen)}><img className={brand ? 'navbar-workspace-brand' : 'navbar-workspace-platform-icon'} src={brand || '/img/icon.svg'} alt=""/><span className="navbar-workspace-copy"><span className="navbar-workspace-label">Workspace</span><span className="navbar-workspace-name">{workspaceName}</span></span><i className="fe fe-chevron-down" aria-hidden="true"/></button>
        {workspaceOpen && <ul className="dropdown-menu navbar-workspace-menu show"><li><h6 className="dropdown-header">Your workspaces</h6></li>{Object.values(settings.projects || {}).map(p=><li key={p.id}><button className={`dropdown-item ${!settings.isGlobalInbox && p.id === project ? 'active' : ''}`} onClick={()=>switchWorkspace(p.id)}>{p.name}</button></li>)}<li><hr className="dropdown-divider"/></li><li><button className={`dropdown-item ${settings.isGlobalInbox ? 'active' : ''}`} onClick={()=>switchWorkspace('')}>Global Inbox</button></li></ul>}</div>
        <div className="navbar-user d-xl-none"><AccountMenu agent={settings.currentAgent}/></div>
        <div className={`navbar-collapse collapse ${open ? 'show' : ''}`} id="sidebarCollapse"><div className="navbar-scroll"><ul className="navbar-nav navbar-nav-primary">
            <li className="nav-item nav-item-inbox has-inbox-views"><a className={`nav-link ${pathname.includes('conversations') || pathname==='/' ? 'active' : ''}`} href={settings.isGlobalInbox ? '/conversations' : `${base}/conversations`}><i className="fe fe-inbox" aria-hidden="true"/><span className="navbar-link-label">Inbox</span><span id="navigation-inbox-unread" hidden><span className="navbar-unread-count"/></span></a><div id="navigation-inbox-views" /></li>
            {settings.isGlobalInbox && <li className="nav-item"><details className="native-global-contacts"><summary><i className="fe fe-users" aria-hidden="true"/><span>Contacts</span><i className="fe fe-chevron-down" aria-hidden="true"/></summary><ul className="nav flex-column">{Object.values(settings.projects || {}).map(p=><li className="nav-item" key={p.id}><a className="nav-link" href={`/projects/${p.id}/contacts`}>Contacts in {p.name}</a></li>)}</ul></details></li>}{(!settings.isGlobalInbox ? [['Contacts','contacts','users'],['Insights','insights','star']] : []).map(([label,path,icon])=><li className="nav-item" key={path}><a className={`nav-link ${active(`${base}/${path}`) ? 'active' : ''}`} href={`${base}/${path}`}><i className={`fe fe-${icon}`} aria-hidden="true"/><span className="navbar-link-label">{label}</span></a></li>)}</ul>
            <div className="navbar-bottom"><ul className="navbar-nav navbar-nav-utility"><li className="nav-item"><button className="nav-link navbar-settings-toggle" type="button" aria-controls="sidebarSettings" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(!settingsOpen)}><i className="fe fe-settings" aria-hidden="true"/><span className="navbar-link-label">Settings</span><i className="fe fe-chevron-up navbar-settings-chevron" aria-hidden="true"/></button><div id="sidebarSettings" hidden={!settingsOpen}><ul className="nav nav-md flex-column">{links.map(([label,path])=><li className="nav-item" key={path}><a className={`nav-link ${active(`${base}/${path}`) ? 'active' : ''}`} aria-current={active(`${base}/${path}`) ? 'page' : undefined} href={`${base}/${path}`}>{label}</a></li>)}<li className="nav-item"><details className="native-extra-settings" open={extraLinks.some(([,path])=>active(`${base}/${path}`)) || undefined}><summary>More settings</summary><ul className="nav flex-column">{extraLinks.map(([label,path])=><li className="nav-item" key={path}><a className={`nav-link ${active(`${base}/${path}`) ? 'active' : ''}`} href={`${base}/${path}`}>{label}</a></li>)}</ul></details></li></ul></div></li></ul></div>
        </div><div className="navbar-user d-none d-xl-flex" id="sidebarUser"><AccountMenu agent={settings.currentAgent} desktop/></div></div>
    </div></nav>;
}
