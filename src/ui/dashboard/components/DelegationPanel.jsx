import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import useConversationDelegations from '../hooks/useConversationDelegations';
import DelegationJob from './DelegationJob';
import DelegationPairing from './DelegationPairing';
import DelegationSkillSetup from './DelegationSkillSetup';
import DelegationTaskForm from './DelegationTaskForm';
import { isWorkerReady } from '../utils/localAgentSetup';

const providerName = provider => provider === 'claude' ? 'Claude' : 'Codex';
const isSkillDevice = device => Boolean(device && device.connection_type === 'skill');
const isSkillListening = device => Boolean(isSkillDevice(device) && device.worker_mode === 'skill' && isWorkerReady(device));
const isStandaloneReady = device => !isSkillDevice(device) && isWorkerReady(device);
const workspaceNameFor = projectId => typeof window === 'undefined' ? null : window.chatSettings?.projects?.[projectId]?.name;

export default function DelegationPanel({ conversation, draftError, isDraftDisabled, onInsertDraft, onConversationChanged }) {
    const [ isSubmitting, setIsSubmitting ] = useState(false);
    const [ isSkillSetupOpen, setIsSkillSetupOpen ] = useState(false);
    const [ isWorkerSetupOpen, setIsWorkerSetupOpen ] = useState(false);
    const [ preferredDeviceId, setPreferredDeviceId ] = useState(null);
    const {
        activeDelegation,
        cancelDelegation,
        createDelegation,
        createPairing,
        devices,
        error,
        isLoading,
        delegations,
        pairing,
        clearPairing,
        refresh,
        revokeDevice,
        sendInput,
        runFollowUp,
    } = useConversationDelegations({
        conversationId: conversation.id,
        projectId: conversation.project_id,
        isSetupOpen: isSkillSetupOpen || isWorkerSetupOpen,
    });
    const availableDevices = devices.filter(device => !device.revoked_at);
    const [ showHistory, setShowHistory ] = useState(false);
    const lastCompletion = useRef(null);
    const completionVersion = delegations.filter(job => job.completed_at).map(job => `${job.id}:${job.completed_at}`).join('|');
    useEffect(() => {
        if (isLoading) return;
        const previous = lastCompletion.current;
        lastCompletion.current = { conversationId: conversation.id, version: completionVersion };
        if (previous?.conversationId === conversation.id && previous.version !== completionVersion) {
            onConversationChanged();
        }
    }, [ conversation.id, completionVersion, isLoading, onConversationChanged ]);
    const visibleJobs = showHistory ? delegations : delegations.filter((job, index) => index < 3
        || [ 'queued', 'running', 'needs_input' ].includes(job.status)
        || [ ...(job.result?.replies || []), ...(job.result?.follow_up_actions || []) ].some(option => !option.status || option.status === 'available' || option.status === 'needs_review'));
    const skillDevice = availableDevices.find(isSkillDevice) || null;
    const listeningSkill = availableDevices.find(isSkillListening) || null;
    const standaloneReadyDevice = availableDevices.find(isStandaloneReady) || null;
    const activeDevice = activeDelegation
        ? availableDevices.find(device => device.id === activeDelegation.device_id) || null
        : null;
    const activeJobIsWorking = Boolean(activeDelegation?.status === 'running' && activeDevice && isWorkerReady(activeDevice));
    const connectionState = activeJobIsWorking
        ? 'working'
        : listeningSkill || standaloneReadyDevice
            ? 'ready'
            : skillDevice
                ? 'waiting'
                : availableDevices.length
                    ? 'stopped'
                    : 'unconnected';
    const connectionDevice = activeDevice || listeningSkill || standaloneReadyDevice || skillDevice || availableDevices[0] || null;
    const connectionName = connectionDevice?.name || providerName(connectionDevice?.provider);
    const connectionText = connectionState === 'working'
        ? (activeDevice?.connection_type === 'skill'
            ? 'Working on this conversation.'
            : connectionName + ' is working on this conversation.')
        : connectionState === 'ready'
            ? (isSkillListening(connectionDevice)
                ? connectionName + ' is ready for assignments.'
                : connectionName + ' is ready for new work.')
            : connectionState === 'waiting'
                ? 'Resume the connected task to receive work.'
                : connectionState === 'stopped'
                    ? 'Start the worker to reconnect this computer.'
                    : 'Connect a Codex or Claude task to get started.';
    const connectionLabel = connectionState === 'working'
        ? 'Working'
        : connectionState === 'ready'
            ? 'Ready'
            : connectionState === 'waiting'
                ? 'Reconnect'
                : connectionState === 'stopped'
                    ? 'Stopped'
                    : 'Not connected';
    const openConnectionSetup = () => setIsSkillSetupOpen(true);
    const connectionAction = connectionDevice?.connection_type === 'skill' && connectionDevice.scope === 'workspace'
        ? 'Connect across workspaces'
        : connectionDevice ? 'Manage' : 'Connect task';

    const submit = async values => {
        setIsSubmitting(true);
        try {
            await createDelegation(values);
        } finally {
            setIsSubmitting(false);
        }
    };

    return <div className="delegation-panel">
        <div className="delegation-panel__intro">
            <span className="delegation-panel__eyebrow"><i className="fe fe-zap" aria-hidden="true" /> HappyToHelp</span>
            <h2>Work with your local agent</h2>
            <p>Delegate this conversation to Codex or Claude on your computer.</p>
        </div>

        <section className={ 'delegation-connection is-' + connectionState } aria-labelledby="delegation-connection-title">
            <span className="delegation-connection__icon"><i className="fe fe-monitor" aria-hidden="true" /></span>
            <div>
                <span className="delegation-connection__status" id="delegation-connection-title">
                    <i className={ connectionState === 'connected' || connectionState === 'ready' ? 'fe fe-check-circle' : connectionState === 'working' ? 'fe fe-loader' : 'fe fe-clock' } aria-hidden="true" />
                    { connectionLabel }
                </span>
                <p>{ connectionText }</p>
                { connectionDevice && <small className="delegation-connection__scope">{ connectionDevice.scope === 'account' ? 'Account connection' : 'Workspace connection' } · { connectionDevice.active_task_count || 0 } / { connectionDevice.max_concurrent_tasks || 1 } active tasks</small> }
            </div>
            <button type="button" className="btn btn-link delegation-connection__action" onClick={ openConnectionSetup }>
                { connectionAction }
            </button>
        </section>

        { (draftError || error) && <div className="delegation-panel__error" role="alert">
            <i className="fe fe-alert-circle" aria-hidden="true" />
            <span>{ draftError || error }</span>
        </div> }

        { isLoading && !delegations.length && !devices.length && <div className="delegation-panel__loading" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Loading local-worker status…
        </div> }

        { visibleJobs.map(job => <DelegationJob
            key={ job.id }
            job={ job }
            isDraftDisabled={ isDraftDisabled }
            onCancel={ cancelDelegation }
            onInsertDraft={ onInsertDraft }
            onSendInput={ sendInput }
            onRunFollowUp={ runFollowUp }
        />) }
        { delegations.length > 3 && <button type="button" className="btn btn-link delegation-history-toggle" onClick={ () => setShowHistory(!showHistory) }>
            { showHistory ? 'Show recent tasks' : 'Show all ' + delegations.length + ' tasks' }
        </button> }

        { !activeDelegation && availableDevices.length > 0 && <DelegationTaskForm
            key={ conversation.id }
            devices={ devices }
            isSubmitting={ isSubmitting }
            onSubmit={ submit }
            preferredDeviceId={ listeningSkill?.id || preferredDeviceId }
        /> }

        { availableDevices.length === 0 && <section className="delegation-empty-worker">
            <h3>Connect a Codex task</h3>
            <p>Use HappyToHelp in the Codex task that will handle support work, then return here to send this conversation.</p>
            <button type="button" className="btn btn-primary" onClick={ () => setIsSkillSetupOpen(true) }>
                Connect task
            </button>
        </section> }

        <DelegationSkillSetup
            device={ connectionDevice }
            isOpen={ isSkillSetupOpen }
            onHide={ () => setIsSkillSetupOpen(false) }
            onUseStandalone={ () => {
                setIsSkillSetupOpen(false);
                setIsWorkerSetupOpen(true);
            } }
            projectId={ conversation.project_id }
            projectName={ workspaceNameFor(conversation.project_id) }
            onSettingsSaved={ () => refresh({ quiet: true }) }
        />

        <DelegationPairing
            createPairing={ createPairing }
            devices={ devices }
            error={ error }
            isOpen={ isWorkerSetupOpen }
            onHide={ () => setIsWorkerSetupOpen(false) }
            onPairingExpired={ clearPairing }
            onRefresh={ () => refresh({ quiet: true }) }
            onRevoke={ revokeDevice }
            onWorkerReady={ setPreferredDeviceId }
            pairing={ pairing }
            projectId={ conversation.project_id }
        />
    </div>;
}

DelegationPanel.propTypes = {
    conversation: PropTypes.shape({
        id: PropTypes.string.isRequired,
        project_id: PropTypes.string.isRequired,
    }).isRequired,
    onInsertDraft: PropTypes.func.isRequired,
    draftError: PropTypes.string,
    isDraftDisabled: PropTypes.bool,
    onConversationChanged: PropTypes.func.isRequired,
};
