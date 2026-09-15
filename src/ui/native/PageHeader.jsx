import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Pages own their controls; the shared frame keeps them alongside the title.
export function PageHeaderActions({ children }) {
    const [target, setTarget] = useState(null);
    useEffect(() => { setTarget(document.getElementById('workspace-header-actions')); }, []);
    return target ? createPortal(children, target) : null;
}

export function PageHeaderTabs({ children }) {
    const [target, setTarget] = useState(null);
    useEffect(() => { setTarget(document.getElementById('workspace-header-tabs')); }, []);
    return target ? createPortal(children, target) : null;
}
