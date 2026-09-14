import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function DelegationCopyButton({ buttonRef, label = 'Copy', showLabel = false, value }) {
    const [ feedback, setFeedback ] = useState('');
    const resetTimer = useRef(null);

    useEffect(() => () => window.clearTimeout(resetTimer.current), []);

    const copy = async () => {
        window.clearTimeout(resetTimer.current);
        try {
            if (!value || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(value);
            setFeedback('Copied');
        } catch (error) {
            setFeedback('Copy failed');
        }
        resetTimer.current = window.setTimeout(() => setFeedback(''), 2000);
    };

    return <button
        ref={ buttonRef }
        type="button"
        className={ 'delegation-copy-button' + (showLabel ? ' is-labelled' : '') }
        onClick={ copy }
        aria-label={ feedback || label }
        title={ feedback || label }
    >
        <i className={ feedback === 'Copied' ? 'fe fe-check' : 'fe fe-copy' } aria-hidden="true" />
        { showLabel ? <span>{ feedback || label }</span> : <span className="visually-hidden">{ feedback || label }</span> }
    </button>;
}

DelegationCopyButton.propTypes = {
    buttonRef: PropTypes.object,
    label: PropTypes.string,
    showLabel: PropTypes.bool,
    value: PropTypes.string.isRequired,
};
