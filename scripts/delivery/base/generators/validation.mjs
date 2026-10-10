/** Shared validation for generated source files; never executes project commands. */
export function object(value, label, keys) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw new Error(`Unknown ${label} field: ${String(key)}`);
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!('value' in property)) throw new Error(`${label} must contain data fields only`);
  }
  return value;
}

export function string(value, label, max) {
  // Match the service command rules: bound the supplied string, then trim it.
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be a non-empty string of at most ${max} characters`);
  return value.trim();
}

export function repository(value) {
  const name = string(value, 'source repository', 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name)) throw new Error('Source repository must be owner/repo');
  return name;
}

export function artifactFilename(value) {
  const name = string(value, 'artifactFile', 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(name) || name.includes('..') || name === 'release-provenance.json') throw new Error('artifactFile must be a root JSON filename other than release-provenance.json');
  return name;
}

export function publicPath(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe integration path');
  rejectPrivatePath(value);
  return value;
}

export function rejectPrivatePath(value) {
  if (value.split('/').some(part => /^(?:\.git|\.hg|\.svn|\.ssh|\.aws|\.wrangler|node_modules|\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.yarnrc(?:\.yml)?|\.netrc|\.pypirc|credentials(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519)$/i.test(part) || /\.(?:pem|key|p12|pfx)$/i.test(part))) throw new Error('Private integration path is forbidden');
}
