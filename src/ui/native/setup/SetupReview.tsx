import type { ReactNode } from 'react';
import type { SetupDraft } from './draft';

// The two notes' line icons, from 12ui's review drawing: a page for what this step creates, an "i" for what it leaves alone.
const icon = (children: ReactNode) => <svg className="setup-note-icon" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
const page = icon(<path d="M9 3h12l8 8v17q0 3-3 3H10q-3 0-3-3V6q0-3 2-3Z M21 3v9h8 M13 17h10M13 23h7" />);
const info = icon(<><circle cx="17" cy="17" r="13" /><path d="M17 16v7" /><circle cx="17" cy="11" r="1.7" fill="currentColor" stroke="none" /></>);

/** The last step: everything the owner entered, then what creating the workspace will and will not do. */
export default function SetupReview({ draft }: { draft: SetupDraft }) {
    return <>
        <dl className="setup-review">{[['Owner', draft.ownerName], ['Email', draft.email], ['Workspace', draft.name], ['Widget website', draft.allowedOrigin], ['Brand colour', draft.primaryColor]].map(([label, value]) => <div key={label}>
            <dt>{label}</dt><dd>{label === 'Brand colour' && <i className="setup-swatch" style={{ background: value }} aria-hidden="true" />}{value}</dd>
        </div>)}</dl>
        <p className="setup-note">{page}This creates your owner account and workspace on this installation. Next, you can install your widget, connect knowledge and configure AI in your workspace.</p>
        <p className="setup-note">{info}No deployment, GitHub connection or invitations will be made by this step.</p>
    </>;
}
