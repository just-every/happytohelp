import React, { useContext, useEffect, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { WidgetSettingsContext } from '../contexts/WidgetSettingsContext';
import WidgetAppearanceFields from './widget-settings/WidgetAppearanceFields';
import WidgetBehaviorFields from './widget-settings/WidgetBehaviorFields';
import WidgetTextFields from './widget-settings/WidgetTextFields';
import WidgetInstallationCode from './widget-settings/WidgetInstallationCode';
import { nativeRequest } from '../../native/transport';
import WidgetPreview from './widget-settings/WidgetPreview';
import { useUnsavedChanges } from '../../native/NavigationGuard';

export default function WidgetSettings({ projectId }) {
    const { markDirty, markSaved } = useUnsavedChanges();
    const { settings, csrfToken, previewAgent, previewBrand } = useContext(WidgetSettingsContext);
    const { register, getValues } = useForm({ defaultValues: settings });
    const [saveError, setSaveError] = useState('');
    const [saved, setSaved] = useState(false);
    const save = async event => { event.preventDefault(); setSaveError(''); setSaved(false); try { await nativeRequest(`/api/management/projects/${projectId}/widget-settings`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(getValues()) }); markSaved(); setSaved(true); } catch(error) { setSaveError(error.message); } };
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
            <form onChange={() => { markDirty(); setSaved(false); window.h2h('settings', getValues()); }} onSubmit={save}>
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
