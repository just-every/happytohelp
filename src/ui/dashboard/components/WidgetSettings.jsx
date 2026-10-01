import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { WidgetSettingsContext } from '../contexts/WidgetSettingsContext';
import WidgetAppearanceFields, { appearanceFieldNames } from './widget-settings/WidgetAppearanceFields';
import WidgetBehaviorFields, { behaviorFieldNames } from './widget-settings/WidgetBehaviorFields';
import WidgetTextFields, { textFieldNames } from './widget-settings/WidgetTextFields';
import { effectiveSettings, previewSettings, settingsToSave } from './widget-settings/settingsModel';
import WidgetInstallationCode from './widget-settings/WidgetInstallationCode';
import { nativeRequest } from '../../native/transport';
import WidgetPreview from './widget-settings/WidgetPreview';
import { useUnsavedChanges } from '../../native/NavigationGuard';

const fieldNames = [...appearanceFieldNames, ...behaviorFieldNames, ...textFieldNames];

export default function WidgetSettings({ projectId }) {
    const { markDirty, markSaved } = useUnsavedChanges();
    const { settings, csrfToken, previewAgent, previewBrand } = useContext(WidgetSettingsContext);
    // The form shows the effective widget (saved overrides over the widget defaults). Only fields the
    // person edits are tracked, so saving without edits stores nothing new and one edit touches one value.
    const { register, getValues } = useForm({ defaultValues: useMemo(() => effectiveSettings(settings, fieldNames), []) });
    const savedSettings = useRef(settings);
    const editedFields = useRef(new Set());
    const edits = () => Object.fromEntries([...editedFields.current].map(name => [name, getValues(name)]));
    const [saveError, setSaveError] = useState('');
    const [saved, setSaved] = useState(false);
    const save = async event => {
        event.preventDefault(); setSaveError(''); setSaved(false);
        const body = settingsToSave(savedSettings.current, edits());
        try {
            await nativeRequest(`/api/management/projects/${projectId}/widget-settings`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            savedSettings.current = body; editedFields.current.clear();
            markSaved(); setSaved(true);
        } catch(error) { setSaveError(error.message); }
    };
    const changed = event => {
        if (fieldNames.includes(event.target.name)) editedFields.current.add(event.target.name);
        markDirty(); setSaved(false);
        window.h2h('settings', previewSettings(savedSettings.current, edits()));
    };
    const [activeTab, setActiveTab] = useState('code');
    const [previewOpen, setPreviewOpen] = useState(true);

    useEffect(() => {
        let preview;
        // Wait until React finishes committing before creating the separate widget root.
        const mount = setTimeout(() => {
            preview = window.h2h('preview', {
                ...settings,
                targetElementId: 'happytohelp',
                inline: true,
                inlineSettings: true,
                preview: {
                    enabled: true,
                    open: true,
                    onOpenChange: setPreviewOpen,
                    agent: previewAgent,
                    workspace_brand: previewBrand,
                },
            });
        }, 0);
        return () => {
            clearTimeout(mount);
            if (preview) setTimeout(() => preview.destroy(), 0);
        };
    }, []);

    const changePreviewState = open => {
        setPreviewOpen(open);
        window.h2h('settings', { preview: { open } });
    };

    return (
        <div className={`widget-settings-layout${activeTab === 'code' ? ' widget-settings-layout--code' : ''}`}>
            <form onChange={changed} onSubmit={save}>
                {saveError && <p role="alert">{saveError}</p>}{saved && <p role="status">Saved.</p>}
                <Tabs activeKey={activeTab} onSelect={setActiveTab} id="widget-settings-tabs">
                    <Tab eventKey="code" title="Code"><WidgetInstallationCode /></Tab>
                    <Tab eventKey="theme" title="Theme"><WidgetAppearanceFields register={register} /></Tab>
                    <Tab eventKey="settings" title="Settings"><WidgetBehaviorFields register={register} /></Tab>
                    <Tab eventKey="texts" title="Texts"><WidgetTextFields register={register} /></Tab>
                </Tabs>
                <div className="settings-actions" hidden={activeTab === 'code'}><button type="submit" className="btn btn-primary">Save</button></div>
            </form>
            <WidgetPreview open={previewOpen} onOpenChange={changePreviewState} hidden={activeTab === 'code'} />
        </div>
    );
}
