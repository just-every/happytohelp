import { useCallback, useEffect, useRef, useState } from 'react';

const COPY_FAILURE_MESSAGE = 'Could not copy. Select the text and try again.';

export default function useCopyFeedback() {
    const [feedback, setFeedback] = useState('');
    const resetTimer = useRef(null);

    useEffect(() => () => {
        if (resetTimer.current) window.clearTimeout(resetTimer.current);
    }, []);

    const copy = useCallback(async text => {
        if (resetTimer.current) window.clearTimeout(resetTimer.current);

        try {
            if (typeof text !== 'string' || !text || !navigator.clipboard?.writeText) {
                throw new Error('Clipboard access is unavailable');
            }

            await navigator.clipboard.writeText(text);
            setFeedback('Copied');
            resetTimer.current = window.setTimeout(() => setFeedback(''), 2000);
            return true;
        } catch (error) {
            setFeedback(COPY_FAILURE_MESSAGE);
            return false;
        }
    }, []);

    return { copy, feedback };
}
