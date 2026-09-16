/** Authenticated-shell parent bridge. No credentials or remote script execution. */
import { validLiveEditSnapshot, normalizeLiveText, validLiveEditPath } from './live-edit-contracts';
import { connectLiveEdits } from './live-edit-runtime';
import { renderedText } from './live-edit-dom';
export type EditorConfig = { enabled: boolean; managementOrigin: string; installationId: string };
export const protocol = 'rer-editor-v1';
export function validOrigin(value: string) {
  try { const url = new URL(value); return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))); } catch { return false; }
}
export function acceptsMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, source: Window | null, installationId: string) {
  const d = event.data;
  if (source === null || event.origin !== origin || event.source !== source || !d || typeof d !== 'object' || Array.isArray(d) || d.protocol !== protocol || d.installationId !== installationId) return false;
  const keys = Object.keys(d).sort().join(',');
  if (['ready','select-element','close'].includes(d.type)) return keys === 'installationId,protocol,type';
  if (d.type === 'capture-context') return keys === 'installationId,protocol,type' || keys === 'installationId,protocol,requestId,type' && typeof d.requestId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(d.requestId);
  if (d.type === 'live-edits') return keys === 'installationId,protocol,snapshot,type' && validLiveEditSnapshot(d.snapshot);
  if (d.type === 'undo-live-edit') return keys === 'id,installationId,protocol,revision,type' && typeof d.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(d.id) && Number.isSafeInteger(d.revision) && d.revision > 0;
  if (d.type === 'set-context-sharing') return keys === 'enabled,installationId,protocol,type' && typeof d.enabled === 'boolean';
  if (d.type === 'set-panel') return keys === 'expanded,installationId,protocol,type' && typeof d.expanded === 'boolean';
  return false;
}
export function selectedElement(element: Element, reviewedText: string) {
  // Structural paths deliberately omit IDs, classes, attributes and DOM text.
  const parts: string[] = [];
  let cursor: Element | null = element;
  while (cursor && parts.length < 6) {
    const tag = cursor.tagName.toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(tag)) break;
    const index: number = cursor.parentElement ? Array.from(cursor.parentElement.children).indexOf(cursor) + 1 : 1;
    parts.unshift(`${tag}:nth-child(${index})`); cursor = cursor.parentElement;
  }
  const role = element.getAttribute('role') || '';
  let navigation: {href:string} | undefined;
  if (element.tagName.toLowerCase() === 'a' && element.closest?.('nav')) {
    try { const href = new URL(element.getAttribute('href') || '',window.location.origin); if (href.origin === window.location.origin && !href.search && !href.hash && validLiveEditPath(href.pathname)) navigation = {href:href.pathname}; } catch {}
  }
  return { ...(navigation ? {navigation} : {}), selector: parts.join(' > ').slice(0,500), tag: element.tagName.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,40), role: /^[a-z-]{1,40}$/.test(role) ? role : '', text: normalizeLiveText(reviewedText.replace(/[\u0000-\u001f\u007f]/g,' ')).slice(0,240) };
}
export function mountEditor(config: EditorConfig, authorized: boolean): () => void {
  if (!authorized || !config.enabled || !validOrigin(config.managementOrigin) || !/^[a-zA-Z0-9_-]{1,100}$/.test(config.installationId)) return () => {};
  const host = document.createElement('div');
  host.dataset.rerEditor = 'v1';
  Object.assign(host.style, {position:'fixed',bottom:'20px',right:'20px',zIndex:'2147483647'});
  const root = host.attachShadow({mode:'open'});
  const launcher = document.createElement('button'); launcher.textContent = 'Edit with Run Edit Run'; launcher.type = 'button';
  Object.assign(launcher.style,{padding:'12px 18px',borderRadius:'24px',background:'#18392e',color:'white',border:'1px solid white',cursor:'pointer'});
  root.append(launcher); document.body.appendChild(host);
  let frame: HTMLIFrameElement | null = null;
  let selecting = false;
  const consentKey = `rer-page-context:${config.managementOrigin}:${config.installationId}`;
  const openKey = `rer-editor-open:${config.managementOrigin}:${config.installationId}`;
  let sharing = true, initiallyOpen = true;
  try { sharing = localStorage.getItem(consentKey) !== 'false'; initiallyOpen = localStorage.getItem(openKey) !== 'false'; } catch {}
  const saveOpen = (open: boolean) => { try { localStorage.setItem(openKey,String(open)); } catch {} };
  const saveSharing = (enabled: boolean) => { sharing = enabled; try { localStorage.setItem(consentKey,String(enabled)); } catch {} };
  const send = (type: string, payload: Record<string,unknown>) => frame?.contentWindow?.postMessage({protocol,type,installationId:config.installationId,...payload},config.managementOrigin);
  const live = connectLiveEdits(result => send('live-edit-result',result));
  const remember = (element: Element,text:string) => { const selection = selectedElement(element,text); live.remember(window.location.pathname,{selector:selection.selector,tag:selection.tag,role:selection.role,beforeText:selection.text,...(selection.navigation ? {navigation:selection.navigation} : {})},element); return selection; };
  let lastPath = window.location.pathname;
  const locationChanged = () => { if (lastPath !== window.location.pathname) { lastPath = window.location.pathname; send('page-location',{path:lastPath}); live.reconcile(); } };
  const observer = new MutationObserver(locationChanged);
  observer.observe(document.body,{subtree:true,childList:true});
  window.addEventListener('popstate',locationChanged);
  const stopSelection = () => { selecting = false; document.removeEventListener('click', select, true); };
  const close = (rememberChoice = true) => { if (rememberChoice) saveOpen(false); stopSelection(); if (frame) frame.hidden = true; launcher.hidden = false; dismiss.hidden = true; };
  const select = (event: MouseEvent) => {
    if (!selecting || event.composedPath().includes(host) || !(event.target instanceof Element)) return;
    event.preventDefault(); event.stopImmediatePropagation(); stopSelection();
    const text = sharing ? renderedText(event.target) : '';
    frame?.contentWindow?.postMessage({protocol,type:'selection',installationId:config.installationId,selection:remember(event.target,text)},config.managementOrigin);
  };
  const receive = (event: MessageEvent) => {
    if (!acceptsMessage(event,config.managementOrigin,frame?.contentWindow || null,config.installationId)) return;
    const d = event.data;
    if (d.type === 'set-panel' && frame) frame.style.width = d.expanded ? 'min(860px, calc(100vw - 40px))' : 'min(460px, calc(100vw - 40px))';
    if (d.type === 'set-context-sharing') { saveSharing(d.enabled); send('context-sharing',{enabled:sharing}); }
    if (d.type === 'ready') { send('context-sharing',{enabled:sharing === true}); send('page-location',{path:window.location.pathname}); }
    if (d.type === 'capture-context') {
      send('context-sharing',{enabled:sharing === true});
      live.clearCapture();
      const elements = !sharing ? [] : Array.from(document.body.querySelectorAll('h1,h2,h3,p,button,a,label,li,th,td')).filter(el => !host.contains(el) && !el.closest('input,textarea,select,[contenteditable],[data-rer-private],[hidden],[aria-hidden="true"]') && (el as HTMLElement).getClientRects().length > 0).slice(0,60).map(el => remember(el,renderedText(el)));
      send('page-context',{...(d.requestId ? {requestId:d.requestId} : {}),context:{kind:'rendered-dom',title:sharing ? document.title.slice(0,160) : '',path:window.location.pathname.slice(0,300),elements,limitations:sharing ? ['Visible DOM text only; not a screenshot.','At most 60 elements; input values and private-marked elements excluded.'] : ['Page text sharing is off']}});
    }
    if (d.type === 'live-edits') {
      try { live.hydrate(d.snapshot); }
      catch(error) { send('live-edits-error',{message:error instanceof Error ? error.message : 'Snapshot rejected.'}); }
    }
    if (d.type === 'undo-live-edit') {
      try { live.undo(d.id,d.revision); }
      catch(error) { send('live-edit-result',{id:d.id,revision:d.revision,status:'conflict',message:error instanceof Error ? error.message : 'Undo failed.'}); }
    }
    if (event.data.type === 'close') close();
    if (event.data.type === 'select-element') { selecting = true; document.addEventListener('click', select, true); }
  };
  const open = (visible = true) => {
    if (visible) saveOpen(true);
    if (frame) { frame.hidden = !visible; launcher.hidden = visible; dismiss.hidden = !visible; return; }
    frame = document.createElement('iframe'); frame.title = 'Run Edit Run editor';
    frame.src = `${config.managementOrigin}/editor?${new URLSearchParams({installation:config.installationId,parentOrigin:window.location.origin})}`;
    frame.referrerPolicy = 'no-referrer'; frame.allow = `microphone ${config.managementOrigin}; autoplay ${config.managementOrigin}`; frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    Object.assign(frame.style,{width:'min(460px, calc(100vw - 40px))',height:'min(740px, calc(100vh - 100px))',border:'1px solid #ccc',borderRadius:'16px',background:'white'});
    frame.hidden = !visible; root.append(frame); launcher.hidden = visible; dismiss.hidden = !visible;
  };
  const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '×'; dismiss.setAttribute('aria-label','Close editor'); dismiss.title = 'Close editor'; dismiss.hidden = true;
  Object.assign(dismiss.style,{position:'absolute',right:'-8px',top:'-12px',width:'28px',height:'28px',padding:'0',borderRadius:'50%',border:'1px solid #d8dedb',background:'#fff',color:'#37443e',fontSize:'20px',lineHeight:'24px',cursor:'pointer',boxShadow:'0 1px 4px #0002'});
  launcher.onclick = () => open();
  dismiss.onclick = () => close(); root.append(dismiss);
  window.addEventListener('message',receive);
  open(initiallyOpen);
  return () => { close(false); frame?.remove(); live.disconnect(); observer.disconnect(); window.removeEventListener('popstate',locationChanged); window.removeEventListener('message',receive); host.remove(); };
}
