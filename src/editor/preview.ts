/** Deliberately small DOM-only preview vocabulary; never evaluates HTML, CSS URLs or scripts. */
export type PreviewChange = { selector: string; styles?: Record<string,string>; text?: string };
export type PreviewRequest = PreviewChange & { requestId: string };
const properties = new Set(['color','background-color','font-size','font-weight','line-height','letter-spacing','text-align','border-color','border-width','border-radius','padding','padding-top','padding-bottom','padding-left','padding-right','margin','gap','max-width','width']);
const shorthandLonghands: Record<string,string[]> = {
  padding:['padding-top','padding-right','padding-bottom','padding-left'],
  margin:['margin-top','margin-right','margin-bottom','margin-left'],
  'border-color':['border-top-color','border-right-color','border-bottom-color','border-left-color'],
  'border-width':['border-top-width','border-right-width','border-bottom-width','border-left-width'],
  'border-radius':['border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius'],
  gap:['row-gap','column-gap'],
};
export function affectedProperties(styles: Record<string,string>) {
  return [...new Set(Object.keys(styles).flatMap(name => shorthandLonghands[name] || [name]))];
}
export function observedTarget(observed: Map<string,Element>, selector: string, matches: ArrayLike<Element>) {
  return matches.length === 1 && observed.get(selector) === matches[0] && matches[0].isConnected;
}
export function validPreview(value: unknown): value is PreviewRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as PreviewRequest;
  if (Object.keys(v).some(k => !['requestId','selector','styles','text'].includes(k)) || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.requestId) || typeof v.selector !== 'string' || v.selector.length > 500 || !/^[a-z][a-z0-9-]*:nth-child\([1-9][0-9]*\)( > [a-z][a-z0-9-]*:nth-child\([1-9][0-9]*\))*$/.test(v.selector)) return false;
  if (v.text !== undefined && (typeof v.text !== 'string' || v.text.length > 500)) return false;
  if (v.styles !== undefined && (!v.styles || typeof v.styles !== 'object' || Array.isArray(v.styles) || Object.keys(v.styles).length > 16 || Object.entries(v.styles).some(([k,val]) => !properties.has(k) || typeof val !== 'string' || val.length > 80 || !/^[#a-zA-Z0-9.,%() -]+$/.test(val) || /url|var|expression|attr|image|inherit|revert/i.test(val)))) return false;
  return v.text !== undefined || !!v.styles && Object.keys(v.styles).length > 0;
}
export function previewElement(element: HTMLElement, change: PreviewChange) {
  if (element.closest('input,textarea,select,option,script,style,iframe,[contenteditable],[data-rer-private],[data-rer-editor]')) throw new Error('This element cannot be previewed.');
  const textNode = element.firstChild;
  if (change.text !== undefined && (element.children.length || !textNode || textNode.nodeType !== 3 || element.childNodes.length !== 1)) throw new Error('Text preview requires an element with one plain text node.');
  const before = new Map<string,{value:string;priority:string}>();
  for (const [name,value] of Object.entries(change.styles || {})) {
    if (!CSS.supports(name,value)) throw new Error(`Unsupported style: ${name}`);
  }
  for (const name of affectedProperties(change.styles || {})) {
    before.set(name,{value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name)});
  }
  const text = textNode?.nodeValue;
  for (const [name,value] of Object.entries(change.styles || {})) element.style.setProperty(name,value);
  if (change.text !== undefined && textNode) textNode.nodeValue = change.text;
  const applied = Object.fromEntries(Array.from(before.keys()).map(name => [name,{value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name)}]));
  const owns = (name: string) => element.style.getPropertyValue(name) === applied[name].value && element.style.getPropertyPriority(name) === applied[name].priority;
  const intact = () => element.isConnected && Array.from(before.keys()).every(owns) && (change.text === undefined || element.firstChild === textNode && textNode?.nodeValue === change.text);
  return {intact,undo(){
    // Restore only values still owned by us: a framework update always wins.
    for (const [name,original] of before) if (owns(name)) {
      if (original.value) element.style.setProperty(name,original.value,original.priority); else element.style.removeProperty(name);
    }
    if (change.text !== undefined && element.firstChild === textNode && textNode?.nodeValue === change.text) textNode.nodeValue = text ?? null;
  }};
}
