import { createElement, lazy } from 'react';

/** Preload and render share code and failures. An already loaded page renders
 * synchronously, without entering Suspense for a resolved import promise. */
export function lazyPageCode(importPage) {
    let pending, Loaded;
    const preload = () => pending ??= importPage().then(module => {
        Loaded = module.default;
        return module;
    });
    const Lazy = lazy(preload);
    const Component = props => createElement(Loaded || Lazy, props);
    return { Component, preload };
}
