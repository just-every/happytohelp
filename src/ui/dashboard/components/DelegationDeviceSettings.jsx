import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Api from '../api';

export default function DelegationDeviceSettings({ device, projectId, projectName, onSaved }) {
    const [ folders, setFolders ] = useState('');
    const [ concurrency, setConcurrency ] = useState(1);
    const [ loading, setLoading ] = useState(true);
    const [ loaded, setLoaded ] = useState(false);
    const [ saving, setSaving ] = useState(false);
    const [ error, setError ] = useState('');
    const [ saved, setSaved ] = useState(false);
    const path = `/projects/${ projectId }/local-agents/${ device.id }/settings`;

    useEffect(() => {
        let current = true;
        setLoading(true);
        setLoaded(false);
        setSaved(false);
        setError('');
        Api.get(path).then(response => {
            if (!current) return;
            setFolders(response.data.working_directories.join('\n'));
            setConcurrency(response.data.max_concurrent_tasks);
            setLoaded(true);
            setLoading(false);
        }).catch(requestError => {
            if (!current) return;
            setError(requestError.message || 'Could not load computer settings.');
            setLoading(false);
        });
        return () => { current = false; };
    }, [ path ]);

    const submit = async event => {
        event.preventDefault();
        if (!loaded || loading || saving) return;
        setSaving(true);
        setSaved(false);
        setError('');
        try {
            await Api.update(path, {
                working_directories: folders.split('\n').map(folder => folder.trim()).filter(Boolean),
                max_concurrent_tasks: Number(concurrency),
            });
            setSaved(true);
            onSaved();
        } catch (requestError) {
            setError(requestError.message || 'Could not save computer settings.');
        } finally {
            setSaving(false);
        }
    };

    return <form className="delegation-computer-settings" onSubmit={ submit } aria-label="Computer settings">
        <div>
            <h3><i className="fe fe-folder" aria-hidden="true" /> Folders for { projectName || 'this workspace' }</h3>
            <p>Suggested starting locations for { device.name || 'this computer' } when working on this workspace’s tasks.</p>
        </div>
        { loading ? <p role="status">Loading settings…</p> : <React.Fragment>
            <label htmlFor="delegation-workspace-folders">Local folder paths</label>
            <textarea id="delegation-workspace-folders" rows={ 3 } value={ folders } onChange={ event => { setFolders(event.target.value); setSaved(false); } } placeholder={'/projects/web\n/projects/api'} disabled={ saving } spellCheck={ false } />
            <p>Optional, one full path per line. These guide the agent; it can work elsewhere or find the project itself. Changes apply to the next task.</p>
            <label htmlFor="delegation-concurrency">Tasks at once on this computer</label>
            <select id="delegation-concurrency" value={ concurrency } onChange={ event => { setConcurrency(event.target.value); setSaved(false); } } disabled={ saving }>
                { Array.from({ length: 8 }, (_, i) => i + 1).map(count => <option key={ count } value={ count }>{ count }{ count === 1 ? ' task' : ' tasks' }</option>) }
            </select>
            <p>The connected session coordinates sub-agents across its workspaces. Tasks that change the same files are coordinated.</p>
            <button type="submit" className="btn btn-primary btn-sm" disabled={ saving || !loaded }>{ saving ? 'Saving…' : 'Save settings' }</button>
        </React.Fragment> }
        { error && <p className="delegation-computer-settings__error" role="alert">{ error }</p> }
        { saved && <p role="status">Computer settings saved.</p> }
    </form>;
}

DelegationDeviceSettings.propTypes = {
    device: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
    projectName: PropTypes.string,
    onSaved: PropTypes.func.isRequired,
};
