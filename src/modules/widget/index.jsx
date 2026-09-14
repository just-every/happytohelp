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
  const config = mergeAdvanced(defaultAppContext, {...options, apiUrl: options.apiOrigin + '/api', projectId: options.widgetKey, inlineSettings: true}, {hardMergeEverything: true});
  const target = options.target || document.getElementById(options.targetElementId || 'happytohelp') || document.body.appendChild(document.createElement('div'));
  if (!target.id) target.id = options.targetElementId || 'happytohelp';
  const ref = createRef();
  let root;
  let revoked = !!config.settings.await_consent;
  const initialize = () => {
    if (root) return;
    Collector.setCollectorEnabled(false); Collector.excludeElement(target);
    root = createRoot(target); root.render(<App ref={ref} config={config} Collector={Collector}/>);
  };
  if (!revoked) initialize();
  activeWidget = {};
  return {
    open: () => ref.current?.open(),
    close: () => ref.current?.close(),
    update: value => ref.current?.update(value),
    request: value => ref.current?.request(value),
    consent: provided => {
      revoked = !provided;
      if (revoked) {root?.unmount(); root = null; Collector.setCollectorEnabled(false); Collector.setMessageHandler(null);}
      else initialize();
    },
    destroy: () => {root?.unmount(); root = null; activeWidget = null; Collector.setCollectorEnabled(false); Collector.setMessageHandler(null);},
  };
}

/** Render genuine widget settings without starting live application activity. */
export function mountPreview(options) {
  const target = options.target || document.getElementById(options.targetElementId || 'happytohelp-preview');
  if (!target) throw new Error('Preview requires an existing target');
  const config = mergeAdvanced(defaultAppContext, {...options, inline: true, inlineSettings: true, preview: {...options.preview, enabled: true}}, {hardMergeEverything: true});
  const root = createRoot(target), ref = createRef();
  root.render(<App ref={ref} config={config} Collector={Collector}/>);
  return {open: () => ref.current?.open(), close: () => ref.current?.close(), update: value => ref.current?.update(value), destroy: () => root.unmount()};
}
