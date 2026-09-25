import React from 'react';
export function Field({ name, label, value, onChange, type = 'text', options, required = false, rows = 6 }) {
    const props = { id: name, name, required, value: value ?? '', onChange: e => onChange(name, type === 'checkbox' ? e.target.checked : type === 'number' ? Number(e.target.value) : e.target.value) };
    if (type === 'checkbox') return <div className="form-check form-switch"><input {...props} value="1" checked={Boolean(value)} className="form-check-input" type="checkbox"/><label className="form-check-label" htmlFor={name}>{label}</label></div>;
    return <div className="form-group"><label htmlFor={name} className="form-label">{label}</label>{options ? <select {...props} className="form-select">{options.map(option=><option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>{typeof option === 'string' ? option : option.label}</option>)}</select> : type === 'textarea' ? <textarea {...props} rows={rows} className="form-control"/> : <input {...props} type={type} className="form-control"/>}</div>;
}
export function Section({ title, description, children }) { return <section className="settings-section"><div className="settings-section__heading"><h2>{title}</h2></div>{description && <p className="settings-section__description">{description}</p>}{children}</section>; }
export function Feedback({ error, saved }) { return <>{error && <div role="alert" className="alert alert-danger">{error}</div>}{saved && <div role="status" className="alert alert-success">Saved.</div>}</>; }
