import React from 'react';
import { useDashboardLocation } from './dashboard-state';
import GitHubSettings from './pages/GitHubSettings';
import ArticleImport from './pages/ArticleImport';
import ProjectsPage from './pages/ProjectsPage';
import AdminPage from './pages/AdminPage';
import { adminTitles } from './pages/AdminRecords';
import KnowledgePage from './pages/KnowledgePage';
import ManagementPage from './pages/ManagementPage';
import ProjectSettings from './pages/ProjectSettings';
import WidgetSettingsPage from './pages/WidgetSettingsPage';
import ComputersPage from './pages/ComputersPage';
import TrainingRuns from './pages/TrainingRuns';
import AccountPage from './pages/AccountPage';
import InsightsPage from './pages/InsightsPage';
const titles={edit:'Project',settings:'Project',ais:'AI',datasets:'AI Training',articles:'Articles',categories:'Categories',agents:'Agents','local-agent':'Local computers','email-settings':'Email','widget-settings':'Widget',macros:'Saved Replies',contacts:'Contacts',plugins:'Integrations',users:'Profile',insights:'Insights','training-runs':'Training runs'};
export default function WorkspacePages({ settings }) {
    const pathname = useDashboardLocation().pathname;
    const segments=pathname.split('/').filter(Boolean);
    const projectId=segments[0]==='projects'?segments[1]:settings.project?.id||Object.keys(settings.projects||{})[0];
    const section=settings.accountOnly?'projects':segments[0]==='projects'&&(!segments[1]||segments[1]==='create')?'projects':segments[0]==='projects'?segments[2]||'edit':segments[0];
    const recordId=segments[0]==='projects'?segments[3]:segments[1];
    let page;
    if(section==='projects')page=<ProjectsPage/>;
    else if(section==='articles'&&recordId==='import')page=<ArticleImport {...{projectId}}/>;
    else if(['datasets','articles','categories'].includes(section))page=<KnowledgePage {...{projectId,section,recordId}} project={settings.projects?.[projectId]||settings.project}/>;
    else if(['ais','macros','contacts','plugins','agents'].includes(section))page=<ManagementPage {...{projectId,section,recordId}}/>;
    else if(['edit','settings','email-settings'].includes(section))page=<ProjectSettings {...{projectId,section}}/>;
    else if(section==='github-settings')page=<GitHubSettings {...{projectId}}/>;
    else if(section==='widget-settings')page=<WidgetSettingsPage {...{projectId}}/>;
    else if(section==='local-agent')page=<ComputersPage {...{projectId}} projectName={settings.projects[projectId]?.name}/>;
    else if(section==='training-runs')page=<TrainingRuns {...{projectId}}/>;
    else if(section==='users')page=<AccountPage {...{projectId,section}}/>;
    else if(section==='admin')page=<AdminPage/>;
    else if(section==='insights')page=<InsightsPage {...{projectId}}/>;
    else page=<p role="alert">This page was not found.</p>;
    let title=titles[section]||'HappyToHelp';
    if(section==='projects')title=segments[1]==='create'?'Create Project':'Projects';
    if(section==='articles')title=recordId==='import'?'Import Articles':recordId?'Articles':'Help Center';
    if(section==='macros'&&recordId==='create')title='Save a Reply';
    if(section==='agents'&&recordId==='create')title='Invite Agent';
    if(section==='plugins')title='Plugins';
    if(section==='github-settings')title='Project';
    if(section==='admin')title=adminTitles[segments[1]||'projects']||'Admin';
    return <div className="main-content"><div className="container-fluid workspace-page-container">
        <div className="header workspace-page-header"><div className="header-body">
            <div className="row align-items-end"><div className="col">
                {section==='users'&&<h6 className="header-pretitle">Overview</h6>}
                <h1 className="header-title display-4">{title}</h1>
            </div><div className="col-auto" id="workspace-header-actions"/></div>
            <div id="workspace-header-tabs"/>
        </div></div>
        <div className="workspace-page-content" key={pathname}>{page}</div>
    </div></div>;
}
