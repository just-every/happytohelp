/** Pinned v1 parent bridge. No credentials, page text, or remote script execution. */
export type EditorConfig = { enabled: boolean; managementOrigin: string; installationId: string };
export const protocol = 'rer-editor-v1';
export function validOrigin(value: string) {
  try { const url = new URL(value); return url.origin === value && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))); } catch { return false; }
}
export function acceptsMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, source: Window | null, installationId: string) {
  const d = event.data;
  return source !== null && event.origin === origin && event.source === source && d !== null && typeof d === 'object' && !Array.isArray(d)
    && Object.keys(d).sort().join(',') === 'installationId,protocol,type' && d.protocol === protocol && d.installationId === installationId
    && ['ready','select-element','close'].includes(d.type);
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
  return { selector: parts.join(' > ').slice(0,500), tag: element.tagName.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,40), role: /^[a-z-]{1,40}$/.test(role) ? role : '', text: reviewedText.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,240) };
}
export function mountEditor(config: EditorConfig, authorized: boolean): () => void {
  if (!authorized || !config.enabled || !validOrigin(config.managementOrigin) || !/^[a-zA-Z0-9_-]{1,100}$/.test(config.installationId)) return () => {};
  const host = document.createElement('div');
  host.dataset.rerEditor = 'v1';
  Object.assign(host.style, {position:'fixed',bottom:'20px',right:'20px',zIndex:'2147483647'});
  const root = host.attachShadow({mode:'closed'});
  const launcher = document.createElement('button'); launcher.textContent = 'Edit with Run Edit Run'; launcher.type = 'button';
  Object.assign(launcher.style,{padding:'12px 18px',borderRadius:'24px',background:'#18392e',color:'white',border:'1px solid white',cursor:'pointer'});
  root.append(launcher); document.body.appendChild(host);
  let frame: HTMLIFrameElement | null = null;
  let selecting = false;
  const stopSelection = () => { selecting = false; document.removeEventListener('click', select, true); };
  const close = () => { stopSelection(); frame?.remove(); frame = null; launcher.hidden = false; };
  const select = (event: MouseEvent) => {
    if (!selecting || event.composedPath().includes(host) || !(event.target instanceof Element)) return;
    event.preventDefault(); event.stopImmediatePropagation(); stopSelection();
    const text = window.prompt('Optional context to share with Run Edit Run (240 characters maximum). Review before sending. Leave empty to share only the element structure.', '');
    if (text === null) return;
    frame?.contentWindow?.postMessage({protocol,type:'selection',installationId:config.installationId,selection:selectedElement(event.target,text)},config.managementOrigin);
  };
  const receive = (event: MessageEvent) => {
    if (!acceptsMessage(event,config.managementOrigin,frame?.contentWindow || null,config.installationId)) return;
    if (event.data.type === 'close') close();
    if (event.data.type === 'select-element') { selecting = true; document.addEventListener('click', select, true); }
  };
  launcher.onclick = () => {
    frame = document.createElement('iframe'); frame.title = 'Run Edit Run editor';
    frame.src = `${config.managementOrigin}/editor?${new URLSearchParams({installation:config.installationId,parentOrigin:window.location.origin})}`;
    frame.referrerPolicy = 'no-referrer'; frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
    Object.assign(frame.style,{width:'min(460px, calc(100vw - 40px))',height:'min(740px, calc(100vh - 100px))',border:'1px solid #ccc',borderRadius:'16px',background:'white',display:'block'});
    root.append(frame); launcher.hidden = true;
  };
  const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Close editor'; dismiss.onclick = close; root.append(dismiss);
  window.addEventListener('message',receive);
  return () => { close(); window.removeEventListener('message',receive); host.remove(); };
}
