import React, { useContext, useState } from 'react';
import { WidgetSettingsContext } from '../../contexts/WidgetSettingsContext';
import { VERIFICATION_SECRET_ENVIRONMENT_VARIABLE } from './code/verificationContract';
import useCopyFeedback from './useCopyFeedback';

const MASKED_SECRET = '••••••••••••••••••••••••••••••••';

export default function SecretControl() {
    const { verificationSecret } = useContext(WidgetSettingsContext);
    const [isRevealed, setIsRevealed] = useState(false);
    const { copy, feedback } = useCopyFeedback();
    const isAvailable = typeof verificationSecret === 'string' && verificationSecret.length > 0;

    return (
        <div className="widget-code__secret">
            <div className="widget-code__secret-frame">
                <code className="widget-code__secret-name">{VERIFICATION_SECRET_ENVIRONMENT_VARIABLE}</code>
                <div className="widget-code__secret-value">
                    <code>{isRevealed && isAvailable ? verificationSecret : MASKED_SECRET}</code>
                </div>
                <div className="widget-code__secret-actions">
                    <button
                        type="button"
                        className="widget-code__secret-action"
                        aria-pressed={isRevealed}
                        aria-label={isRevealed ? 'Hide server secret' : 'Reveal server secret'}
                        disabled={!isAvailable}
                        onClick={() => setIsRevealed(revealed => !revealed)}
                    >
                        <i className={`fe fe-${isRevealed ? 'eye-off' : 'eye'}`} aria-hidden="true" />
                        {isRevealed ? 'Hide' : 'Reveal'}
                    </button>
                    <button
                        type="button"
                        className="widget-code__secret-action"
                        aria-label="Copy server secret"
                        disabled={!isAvailable}
                        onClick={() => copy(verificationSecret)}
                    >
                        <i className="fe fe-copy" aria-hidden="true" /> Copy secret
                    </button>
                    <span className="widget-code__copy-feedback" role="status" aria-live="polite">{feedback}</span>
                </div>
            </div>
            {!isAvailable && <p className="widget-code__secret-unavailable" role="note">The server secret is only available to project owners and admins.</p>}
            <div className="widget-code__secret-note">
                <span>Environment variable name:</span> <code>{VERIFICATION_SECRET_ENVIRONMENT_VARIABLE}</code>
                <span className="widget-code__secret-server-only"><i className="fe fe-lock" aria-hidden="true" /> Server only. Never expose this value in client-side code.</span>
            </div>
        </div>
    );
}
