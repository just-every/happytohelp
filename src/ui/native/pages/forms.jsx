import React from 'react';
/** Form field with an optional hint and a field-level validation message wired to the control. */
export function Field({ name, label, value, onChange, type = 'text', options, required = false, rows = 6, hint, error, min, max, step, placeholder }) {
    const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined;
    const numeric = type === 'number';
    const props = {
        id: name, name, required, value: value ?? '', 'aria-describedby': describedBy, 'aria-invalid': error ? 'true' : undefined,
        onChange: e => onChange(name, type === 'checkbox' ? e.target.checked : numeric ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value),
    };
    const notes = <>{hint && <div id={`${name}-hint`} className="form-text">{hint}</div>}{error && <div id={`${name}-error`} className="invalid-feedback d-block" role="alert">{error}</div>}</>;
    if (type === 'checkbox') return <div className="form-check form-switch"><input {...props} value="1" checked={Boolean(value)} className="form-check-input" type="checkbox"/><label className="form-check-label" htmlFor={name}>{label}</label>{notes}</div>;
    const className = `${options ? 'form-select' : 'form-control'}${error ? ' is-invalid' : ''}`;
    return <div className="form-group"><label htmlFor={name} className="form-label">{label}</label>{options ? <select {...props} className={className}>{options.map(option=><option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>{typeof option === 'string' ? option : option.label}</option>)}</select> : type === 'textarea' ? <textarea {...props} rows={rows} placeholder={placeholder} className={className}/> : <input {...props} type={type} min={min} max={max} step={step} placeholder={placeholder} className={className}/>}{notes}</div>;
}
export function Section({ title, description, children }) { return <section className="settings-section"><div className="settings-section__heading"><h2>{title}</h2></div>{description && <p className="settings-section__description">{description}</p>}{children}</section>; }
export function Feedback({ error, saved }) { return <>{error && <div role="alert" className="alert alert-danger">{error}</div>}{saved && <div role="status" className="alert alert-success">Saved.</div>}</>; }
