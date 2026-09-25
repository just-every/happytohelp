import { createHash } from 'node:crypto';

// The bootstrap session belongs only to the owner this process just created.
// Keep it in this closure: never put it in installer state or on disk.
export function createArtworkBridge({onStatus = () => {}} = {}) {
 let owner, pending, running, expiry, closed = false;
 const attempted = new Set();
 const status = (item, phase, error) => onStatus({id:item.id,revision:item.revision,phase,...(error ? {error} : {})});
 const current = item => !closed && item.isCurrent();
 const request = (path, options = {}) => fetch(owner.origin + path, {
  ...options, redirect:'error', headers:{Authorization:`Bearer ${owner.token}`,...options.headers}, signal:AbortSignal.timeout(15000),
 });
 const projectPath = () => `/api/management/projects/${encodeURIComponent(owner.projectId)}`;
 const color = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value.toLowerCase() : null;
 const matches = (value,item) => ['website','name'].every(key => value[key] === item.context[key]) && color(value.primaryColor) !== null && color(value.primaryColor) === color(item.context.primaryColor);
 const appearance = async () => {
  const result = await request(projectPath() + '/appearance');
  if (!result.ok) throw Error('Appearance could not be checked.');
  return (await result.json()).data;
 };
 const hash = bytes => createHash('sha256').update(bytes).digest('hex');
 async function reconcile(item) {
  try {
   const value = await appearance();
   const prefix = projectPath() + '/artwork/';
   if (!matches(value,item) || typeof value.artwork_url !== 'string' || !value.artwork_url.startsWith(prefix) || !/^[^/?#]+$/.test(value.artwork_url.slice(prefix.length))) return false;
   const result = await request(value.artwork_url);
   return result.ok && hash(Buffer.from(await result.arrayBuffer())) === hash(item.bytes);
  } catch { return false; }
 }
 async function transfer(item) {
  if (!current(item)) return status(item,'skipped');
  let value;
  try { value = await appearance(); }
  catch { return status(item,'error','Your workspace artwork could not be checked. Open the app to finish personalizing it.'); }
  if (!current(item) || !matches(value,item) || value.artwork_url) return status(item,'skipped');
  status(item,'uploading');
  let result;
  try {
   result = await request(projectPath() + '/artwork', {
    method:'PUT',headers:{'Content-Type':'image/png','x-h2h-expected-workspace':encodeURIComponent(JSON.stringify(item.context)),'x-h2h-expected-artwork':'none'},body:item.bytes,
   });
  } catch {
   const applied = await reconcile(item);
   return status(item,applied ? 'applied' : 'unknown',applied ? undefined : 'The upload result is uncertain. Check your artwork in the app before uploading again.');
  }
  if (result.ok) return status(item,'applied');
  if (result.status === 409) return status(item,'skipped');
  if (result.status >= 500) {
   const applied = await reconcile(item);
   return status(item,applied ? 'applied' : 'unknown',applied ? undefined : 'The upload result is uncertain. Check your artwork in the app before uploading again.');
  }
  status(item,'error','Your workspace did not accept the artwork. Open the app to finish personalizing it.');
 }
 function flush() {
  if (running || !owner || !pending || closed) return running || Promise.resolve();
  running = (async () => {
   while (owner && pending && !closed) {
    const item = pending;pending = undefined;
    const key = `${item.id}:${item.revision}`;
    if (attempted.has(key)) continue;
    attempted.add(key);
    await transfer(item);
   }
  })().finally(() => {running = undefined;});
  return running;
 }
 return {
  async attach({origin,token,userId,projectId}) {
   if (closed || owner) throw Error('The artwork bridge is already bound or closed.');
   const url = new URL(origin);
   if (!['http:','https:'].includes(url.protocol) || url.origin !== origin || !token || !userId || !projectId) throw Error('Invalid owner artwork handoff.');
   owner = {origin,token,userId,projectId};
   expiry = setTimeout(() => {owner = undefined;pending = undefined;closed = true;},24*60*60*1000);expiry.unref();
   await flush();
  },
  async deliver(item) {
   if (closed) return;
   if (!item || typeof item.isCurrent !== 'function' || !Buffer.isBuffer(item.bytes) || !item.id || !Number.isInteger(item.revision) || !item.context || !['website','name','primaryColor'].every(key => typeof item.context[key] === 'string')) throw Error('Invalid artwork result.');
   if (!current(item)) return status(item,'skipped');
   if (attempted.has(`${item.id}:${item.revision}`)) return;
   if (!color(item.context.primaryColor)) throw Error('Invalid workspace artwork colour.');
   pending = {...item,context:{...item.context,primaryColor:color(item.context.primaryColor)},bytes:Buffer.from(item.bytes)};
   status(item,'pending');
   await flush();
  },
  close() {closed = true;owner = undefined;pending = undefined;clearTimeout(expiry);},
 };
}
