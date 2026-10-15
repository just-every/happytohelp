import React from 'react';
import { Section } from './forms';
import ProviderSetupNotice from '../activation/ProviderSetupNotice';

export default function TrainingRunDetails({ run, path, projectId, disabled, onCancel }) {
    return <Section title="Run details">
        <p>Status: {run.status}</p>
        <button className="btn btn-white" disabled={disabled} onClick={() => onCancel(run.id)}>Cancel run</button>
        {run.cases?.map(item => <article key={item.id}>
            <h3>{item.name || item.id}</h3>
            <p>{item.status}</p>
            {item.error && <p role="alert">{item.error}</p>}
            {item.error?.startsWith('CONFIGURATION_REQUIRED:') && <ProviderSetupNotice projectId={projectId} error={item.error}/>}
            {item.status === 'uncertain' && <p>This attempt will not be replayed automatically. Inspect its error and any retained output before starting another run.</p>}
            {item.artifact_available && <a href={`${path}/${run.id}/cases/${item.id}/artifact`}>Open retained artifact</a>}
        </article>)}
    </Section>;
}
