import React from 'react';
export default function WorkspaceName({settings}) {
 const name=settings.projectUnavailable?'Workspace unavailable':settings.accountOnly?'Your account':settings.isGlobalInbox?'Global Inbox':settings.project?.name;
 return <p className="workspace-header-name" data-testid="workspace-header-name" title={name}>{name}</p>;
}
