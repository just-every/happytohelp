import { nativeRequest } from './transport';
import React, { useState } from 'react';
export default function Navigation({ settings }) {
    const [open, setOpen] = useState(false);
    const [settingsOpen,setSettingsOpen] = useState(!location.pathname.includes('conversations'));
    const project = settings.project?.id || Object.keys(settings.projects || {})[0];
    const base = project ? `/projects/${project}` : '';
    const links = [['Project','edit'],['Billing','billing'],['AI','ais'],['Training','datasets'],['Knowledge','articles'],['Categories','categories'],['Agents','agents'],['Local computers','local-agent'],['Email','email-settings'],['Widget','widget-settings'],['Saved Replies','macros'],['Integrations','plugins'],['GitHub','github-settings']];
    return <nav className="navbar navbar-vertical fixed-left navbar-expand-xl navbar-light navbar-refined" id="sidebar" aria-label="Main navigation"><div className="container-fluid">
        <button className="navbar-toggler" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}><span className="navbar-toggler-icon" /></button>
        <a className="navbar-workspace-toggle" href="/conversations"><img className="navbar-workspace-platform-icon" src="/img/icon.svg" alt=""/><span>Happy to Help</span></a>
        <label className="visually-hidden" htmlFor="workspace">Workspace</label><select id="workspace" className="form-select native-workspace-select" value={settings.project?.id || ''} onChange={async e=>{const id=e.target.value;if(id)await nativeRequest('/api/identity/switch-project',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id})});location.assign(id?`/projects/${id}/conversations`:'/conversations');}}><option value="">All workspaces</option>{Object.values(settings.projects || {}).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div className={`navbar-collapse collapse ${open ? 'show' : ''}`} id="sidebarCollapse"><div className="navbar-scroll"><ul className="navbar-nav navbar-nav-primary">
            <li className="nav-item nav-item-inbox has-inbox-views"><a className="nav-link" href={settings.isGlobalInbox ? '/conversations' : `${base}/conversations`}><span className="navbar-link-label">Inbox</span><span id="navigation-inbox-unread" hidden /></a><div id="navigation-inbox-views" /></li>
            <li className="nav-item"><a className="nav-link" href={`${base}/contacts`}>Contacts</a></li><li className="nav-item"><a className="nav-link" href={`${base}/insights`}>Insights</a></li></ul>
            <div className="navbar-bottom"><ul className="navbar-nav navbar-nav-utility"><li className="nav-item"><button className="nav-link navbar-settings-toggle" type="button" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(!settingsOpen)}>Settings</button><ul className="nav nav-md flex-column" hidden={!settingsOpen}>{links.map(([label,path])=><li className="nav-item" key={path}><a className="nav-link" href={`${base}/${path}`}>{label}</a></li>)}</ul></li></ul></div>
        </div><div className="navbar-user d-xl-flex"><a href="/users/profile">{settings.currentAgent.name}</a><a className="ms-auto" href="/admin">Admin</a><button className="btn btn-link" onClick={async()=>{await nativeRequest('/api/identity/session',{method:'DELETE'});location.assign('/login');}}>Sign out</button></div></div>
    </div></nav>;
}
