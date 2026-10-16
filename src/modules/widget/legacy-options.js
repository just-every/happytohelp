/** Installed snippets use public project ids, never operator or visitor credentials. */
export function scriptOptions(script) {
  if (!script) return null;
  const data = script.dataset;
  let options = data.config ? JSON.parse(data.config.replace(/'/g, '"')) : {};
  const projectId = data.project || data.projectid || data.projectId;
  if (projectId) options.projectId = projectId;
  if (data.widgetKey) options.widgetKey = data.widgetKey;
  if (data.apiOrigin) options.apiOrigin = data.apiOrigin;
  return options.widgetKey || options.projectId || options.project_id ? options : null;
}

export function normalizeWidgetOptions(options = {}, script) {
  const {apiUrl, wsUrl, project_id, projectId, await_consent, ...native} = options;
  const legacy = !native.widgetKey && !!(projectId || project_id);
  const api = new URL(native.apiOrigin || script?.dataset.apiOrigin || apiUrl || script?.src || location.origin);
  if (api.username || api.password || api.protocol !== 'https:' && !(api.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(api.hostname))) throw new Error('Widget API requires HTTPS without embedded credentials');
  const apiOrigin = api.origin;
  const result = {...native, apiOrigin, open: native.open ?? (location.hash === '#launch-chat'), settings: {...native.settings}};
  if (await_consent !== undefined) result.settings.await_consent = !!await_consent;
  if (legacy) {
    result.legacyProjectId = String(projectId || project_id);
    result.contact = legacyContact(native.contact);
  }
  return result;
}

export function legacyContact(contact = {}) {
  // Old signatures and contact keys remain legacy authority. Native re-verification
  // must be issued by the native installation, using its widgetKey form.
  const {hash, key, token, metadataHash, metadata, ...preferences} = contact;
  if (hash || key || token || metadataHash || metadata?.hash) console.warn('HappyToHelp: legacy contact credentials require native re-verification; this visitor is unverified.');
  return preferences;
}

export function legacyUpdate(value = {}) {
  const {identifier, hash, metadataHash, metadata, name, email, ...update} = value;
  const fields = {identifier, hash, metadataHash, metadata, name, email};
  const supplied = Object.fromEntries(Object.entries(fields).filter(([, item]) => item !== undefined));
  if (Object.keys(supplied).length || update.contact) update.contact = legacyContact({...supplied, ...update.contact});
  return update;
}

export async function resolveWidgetOptions(options, signal) {
  if (!options.legacyProjectId) return options;
  const response = await fetch(`${options.apiOrigin}/api/widget/legacy-project?projectId=${encodeURIComponent(options.legacyProjectId)}`, {signal, credentials: 'omit'});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Legacy widget project is unavailable on this origin');
  return {...options, widgetKey: result.widgetKey};
}
