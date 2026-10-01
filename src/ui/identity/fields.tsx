import type { InputHTMLAttributes } from 'react';

export function Field({ id, label, hint, ...input }: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
    return <div className="id-field">
        <label htmlFor={id}>{label}</label>
        <input id={id} name={id} required aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
        {hint && <p className="id-hint" id={`${id}-hint`}>{hint}</p>}
    </div>;
}

/** The server accepts passwords of 12 to 1024 characters (src/modules/identity/credentials.ts); the browser enforces the same. */
export function NewPasswordField({ label = 'Password' }: { label?: string }) {
    return <Field id="password" label={label} type="password" minLength={12} maxLength={1024} autoComplete="new-password" hint="Use 12 to 1024 characters." />;
}

export function Alert({ children }: { children: string }) {
    return children ? <p className="id-alert" role="alert">{children}</p> : null;
}

export function SubmitButton({ busy, ready, children, busyLabel = 'Working…' }: { busy: boolean; ready: boolean; children: string; busyLabel?: string }) {
    return <button className="pill pill--ink" disabled={busy || !ready}>{busy ? busyLabel : children}</button>;
}
