import {mountWidget, mountPreview} from './index';
const script = document.currentScript;
let widget;
window.h2h = (action, options) => {
  if (action === 'preview') {widget?.destroy(); widget = mountPreview(options); return widget;}
  if (action === 'init') {widget?.destroy(); widget = mountWidget(options); return widget;}
  if (!widget) throw new Error('Initialize HappyToHelp before using its API');
  if (action === 'consent') return widget.consent(options.provided);
  if (action === 'settings') action = 'update';
  if (['ask','sales','support'].includes(action)) return widget.request({...options, method: action});
  if (typeof widget[action] !== 'function') throw new Error(`Unknown widget action: ${action}`);
  return widget[action](options);
};
const queue = window.h2hQueue || [];
if (script?.dataset.widgetKey) queue.unshift(['init', {widgetKey: script.dataset.widgetKey, apiOrigin: script.dataset.apiOrigin || new URL(script.src).origin}]);
for (const [action, options] of queue) window.h2h(action, options);
