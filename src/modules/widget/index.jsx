import React, {createRef} from 'react';
import {createRoot} from 'react-dom/client';
import {mergeAdvanced} from 'object-merge-advanced';
import {config as iconConfig} from '@fortawesome/fontawesome-svg-core';
import App from './js/App';
import Collector from './js/collection/Collector';
import {defaultAppContext} from './js/context/AppContext';
iconConfig.autoAddCss = false;

let activeWidget = null;

/** Each install owns its root and authenticated transport; widgetKey is public, never an operator token. */
export function mountWidget(options) {
  if (activeWidget) throw new Error('Destroy the existing widget before mounting another project');
  if (!options.apiOrigin || !options.widgetKey) throw new Error('apiOrigin and widgetKey are required');
  if (options.preview?.enabled) throw new Error('Live widget mounting does not accept preview data');
  const config = mergeAdvanced(defaultAppContext, {...options, open: options.open ?? (location.hash === '#launch-chat'), apiUrl: options.apiOrigin + '/api', projectId: options.widgetKey, inlineSettings: true}, {hardMergeEverything: true});
  const target = options.target || document.getElementById(options.targetElementId || 'happytohelp') || document.body.appendChild(document.createElement('div'));
  if (!target.id) target.id = options.targetElementId || 'happytohelp';
  const ref = createRef();
  let root;
  let destroyed = false;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {resolveReady = resolve; rejectReady = reject;});
  // Direct users may destroy a consent-gated mount without awaiting readiness.
  ready.catch(() => {});
  const onReady = () => resolveReady();
  const launchChat = () => {if (location.hash === '#launch-chat') {config.open = true; ref.current?.open();}};
  const launchLink = event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash === '#launch-chat') {config.open = true; ref.current?.open();}
  };
  const removeLaunchListeners = () => {window.removeEventListener('hashchange', launchChat); document.removeEventListener('click', launchLink);};
  const owner = {};
  let revoked = !!config.settings.await_consent;
  const initialize = () => {
    if (root || destroyed) return;
    window.addEventListener('hashchange', launchChat);
    document.addEventListener('click', launchLink);
    Collector.setCollectorEnabled(false); Collector.excludeElement(target);
    root = createRoot(target); root.render(<App ref={ref} config={config} Collector={Collector} onReady={onReady}/>);
  };
  if (!revoked) initialize();
  activeWidget = owner;
  return {
    ready,
    open: () => {config.open = true; return ref.current?.open();},
    close: () => {config.open = false; return ref.current?.close();},
    update: value => ref.current?.update(value),
    request: value => ready.then(() => ref.current?.request(value)),
    consent: provided => {
      if (destroyed) return;
      revoked = !provided;
      if (revoked) {root?.unmount(); root = null; removeLaunchListeners(); Collector.destroy();}
      else initialize();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      removeLaunchListeners();
      rejectReady(new Error('Widget was destroyed'));
      root?.unmount(); root = null;
      if (activeWidget === owner) { activeWidget = null; Collector.destroy(); }
    },
  };
}

/** Render genuine widget settings without starting live application activity. */
export function mountPreview(options) {
  const target = options.target || document.getElementById(options.targetElementId || 'happytohelp-preview');
  if (!target) throw new Error('Preview requires an existing target');
  const config = mergeAdvanced(defaultAppContext, {...options, inline: true, inlineSettings: true, preview: {...options.preview, enabled: true}}, {hardMergeEverything: true});
  const root = createRoot(target), ref = createRef();
  root.render(<App ref={ref} config={config} Collector={Collector}/>);
  let destroyed = false;
  return {open: () => ref.current?.open(), close: () => ref.current?.close(), update: value => ref.current?.update(value), destroy: () => {
    if (destroyed) return;
    destroyed = true;
    root.unmount();
  }};
}
