import { preloadConversation } from './inbox-page-code';
import { lazyPageCode } from './lazy-page-code';
import { isInboxPath } from './workspace-scope';
import { preloadWorkspacePage } from './workspace-page-code';

const inbox = lazyPageCode(() => import('./InboxPage'));
const workspace = lazyPageCode(() => import('./WorkspacePages'));
export const InboxPage = inbox.Component;
export const WorkspacePages = workspace.Component;

/** Start shell and route code with bootstrap; callers await this before revealing the page. */
export function preloadDashboardPage(pathname, settings) {
    const isInbox = isInboxPath(pathname, settings ?? {});
    return Promise.all([
        ...(isInbox && /\/conversations\/[^/]+/.test(pathname) ? [preloadConversation()] : []),
        ...(isInbox
            ? [inbox.preload()]
            : [workspace.preload(), preloadWorkspacePage(pathname, settings)]),
    ]);
}
