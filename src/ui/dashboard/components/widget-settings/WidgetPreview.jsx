import React from 'react';

export default function WidgetPreview({ open, onOpenChange, hidden }) {
    return (
        <aside className="widget-settings-preview" aria-label="Widget preview" hidden={hidden}>
            <div className="widget-settings-preview__header">
                <span>Preview</span>
                <div className="widget-settings-preview__states" role="group" aria-label="Preview state">
                    <button type="button" aria-pressed={!open} onClick={() => onOpenChange(false)}>Launcher</button>
                    <button type="button" aria-pressed={open} onClick={() => onOpenChange(true)}>Conversation</button>
                </div>
            </div>
            <div className="widget-settings-preview__stage">
                <div id="happytohelp"></div>
            </div>
            <p className="settings-note widget-settings-preview__note">Try the widget here. Preview messages stay in this editor.</p>
        </aside>
    );
}
