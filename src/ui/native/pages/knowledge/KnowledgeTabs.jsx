import React from 'react';
import { Link } from '@tanstack/react-router';
import { PageHeaderTabs } from '../../PageHeader';

const tabs = [
    ['articles', 'Articles'],
    ['categories', 'Categories'],
    ['datasets', 'Website sources'],
    ['training-runs', 'Evaluation runs'],
];

export default function KnowledgeTabs({ projectId, activeSection }) {
    return <PageHeaderTabs>
        <nav aria-label="Knowledge sections">
            <ul className="nav nav-tabs header-tabs">
                {tabs.map(([section, label]) => {
                    const active = section === activeSection;
                    return <li className="nav-item" key={section}>
                        <Link
                            className={`nav-link${active ? ' active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                            to={`/projects/${projectId}/${section}`}
                        >{label}</Link>
                    </li>;
                })}
            </ul>
        </nav>
    </PageHeaderTabs>;
}
