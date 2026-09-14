import {useContext, useEffect, forwardRef, useImperativeHandle, useCallback, useRef} from 'react';
import {ConnectContext} from './context/ConnectContext';
import {v4 as uuidv4} from 'uuid';

const Connection = forwardRef((_props, ref) => {
    const {sendMessage, lastResponse} = useContext(ConnectContext);
    const pending = useRef(new Map());
    const request = useCallback(async ({onChange, ...params} = {}) => {
        const requestId = uuidv4();
        return new Promise((resolve, reject) => {
            pending.current.set(requestId, {resolve, reject, onChange});
            sendMessage('request', {...params, requestId}).then(result => {
                if (result?.requestId || result?.response) {
                    onChange?.(result);
                    resolve(result);
                    if (!onChange) pending.current.delete(requestId);
                }
            }).catch(error => {pending.current.delete(requestId); reject(error);});
        });
    }, [sendMessage]);
    useImperativeHandle(ref, () => ({request}), [request]);
    useEffect(() => {
        const entry = pending.current.get(lastResponse?.requestId);
        if (!entry) return;
        entry.onChange?.(lastResponse); entry.resolve(lastResponse);
        if (!entry.onChange) pending.current.delete(lastResponse.requestId);
    }, [lastResponse]);
    useEffect(() => () => {for (const entry of pending.current.values()) entry.reject(new Error('Widget was closed')); pending.current.clear();}, []);
    return null;
});
export default Connection;
