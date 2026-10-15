import React from 'react';
import { Field } from './forms';

export default function HelpCenterAddress({ projectId, value, onChange }) {
    let external;
    try {
        const address = new URL(value);
        if (['https:', 'http:'].includes(address.protocol) && !address.username && !address.password) external = address.href;
    } catch {}
    return <>
        <p><a href={`/help/${projectId}`} target="_blank" rel="noreferrer">View Help Center</a></p>
        <Field name="help_center_domain" label="Custom Help Center URL" type="url" value={value} onChange={onChange}
            placeholder="https://support.example.com"
            hint="Optional full HTTPS address for your existing Help Center, used as support context. Saving it does not create a /help alias or configure a domain. Your hosting administrator must configure DNS, TLS and routing separately. Leave blank to use the built-in Help Center above." />
        {external && <p><a href={external} target="_blank" rel="noreferrer">Open custom address to verify it</a></p>}
    </>;
}
