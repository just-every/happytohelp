import React from 'react';

export default function WidgetFieldSection({ title, children }) {
    return (
        <section className="settings-section">
            <h2 className="settings-section__heading">{title}</h2>
            <div className="settings-grid">{children}</div>
        </section>
    );
}
