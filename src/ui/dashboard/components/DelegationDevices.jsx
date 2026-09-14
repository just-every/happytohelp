import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { isWorkerReady } from '../utils/localAgentSetup';

const providerName = provider => provider === 'claude' ? 'Claude' : 'Codex';
const deviceStatus = device => {
    if (device.revoked_at) return 'Revoked';
    if (isWorkerReady(device)) return 'Ready';
    if (device.pairing_id) return 'Waiting for worker';
    return 'Legacy connection';
};

export default function DelegationDevices({ devices, onRevoke }) {
    const [ pendingRevoke, setPendingRevoke ] = useState(null);
    const currentDevices = devices.filter(device => !device.revoked_at);
    const revokedDevices = devices.filter(device => device.revoked_at);

    const revoke = async device => {
        setPendingRevoke(device.id);
        try {
            await onRevoke(device.id);
        } catch (error) {
            // The shared hook supplies an actionable API error.
        } finally {
            setPendingRevoke(null);
        }
    };

    if (!devices.length) return <p className="delegation-devices__empty">No paired computers yet.</p>;

    return <section className="delegation-devices" aria-labelledby="delegation-devices-title">
        <div className="delegation-devices__heading">
            <div>
                <h3 id="delegation-devices-title">Paired computers</h3>
                <p>Only you can use or revoke these connectors.</p>
            </div>
            <span>{ currentDevices.length } active</span>
        </div>
        <ul>
            { currentDevices.map(device => <li key={ device.id }>
                <span className={ 'delegation-device__status' + (isWorkerReady(device) ? ' is-ready' : '') } aria-label={ deviceStatus(device) } />
                <span className="delegation-device__identity">
                    <strong>{ device.name || providerName(device.provider) }</strong>
                    <small>{ providerName(device.provider) } · { deviceStatus(device).toLowerCase() }</small>
                </span>
                <button type="button" className="btn btn-link" onClick={ () => revoke(device) } disabled={ pendingRevoke === device.id }>
                    { pendingRevoke === device.id ? 'Revoking…' : 'Revoke' }
                </button>
            </li>) }
            { revokedDevices.map(device => <li key={ device.id } className="is-revoked">
                <span className="delegation-device__status" aria-label="Revoked" />
                <span className="delegation-device__identity">
                    <strong>{ device.name || providerName(device.provider) }</strong>
                    <small>Revoked</small>
                </span>
            </li>) }
        </ul>
    </section>;
}

DelegationDevices.propTypes = {
    devices: PropTypes.arrayOf(PropTypes.object).isRequired,
    onRevoke: PropTypes.func.isRequired,
};
