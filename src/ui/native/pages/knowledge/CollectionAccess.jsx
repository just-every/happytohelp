import React from 'react';
import { Field } from '../forms';

export const audienceLabel = audience => ({public: 'Public', 'signed-in': 'Signed-in customers', domains: 'Selected email domains'})[audience] || 'Public';

export default function CollectionAccess({ draft, change }) {
    const domains = Array.isArray(draft.allowedDomains) ? draft.allowedDomains.join('\n') : draft.allowedDomains || '';
    return <fieldset className="knowledge-governance-group">
        <legend>Collection access</legend>
        <Field name="audience" label="Who can read this collection?" value={draft.audience || 'public'} onChange={change} options={[
            {value: 'public', label: 'Anyone (public)'},
            {value: 'signed-in', label: 'Signed-in customers'},
            {value: 'domains', label: 'Customers with selected email domains'},
        ]}/>
        {draft.audience === 'domains' && <Field name="allowedDomains" label="Allowed email domains" type="textarea" rows={3} value={domains} onChange={change} required hint="Enter one domain per line, such as example.com. Customers must sign in with a verified email address from an allowed domain."/>}
        <p className="settings-note">Applies to articles in this collection and its child collections, including search results and AI answers. Publishing a collection does not override its access rules.</p>
    </fieldset>;
}
