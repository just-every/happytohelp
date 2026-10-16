import {credentialColumns} from './scope.mjs';

const secretName = /key|secret|token|password|hash|salt|credential|encrypt/i;
// Exact reviewed noncredential fields, never an entire JSON/text exception.
const exportedNames = new Set([
  'projects.widget_settings_hash', // widget cache checksum
  'media.object_key', // exporter-generated storage path; also checked by enrichMedia
]);
const checksum = /^[a-f0-9]{32}$/i;
const usageCounters = new Set([
  'prompt_tokens','completion_tokens','total_tokens','input_tokens','output_tokens',
  'cached_tokens','reasoning_tokens','audio_tokens','accepted_prediction_tokens','rejected_prediction_tokens',
]);
const usageContainers = new Set(['prompt_tokens_details','completion_tokens_details','input_tokens_details','output_tokens_details']);
const refuse = location => { throw new Error(`Unclassified secret-like legacy field: ${location}; explicitly classify export/omit before exporting`); };

/** Classify inventory before selecting payloads. Whole-table omissions live in scope. */
export function classifyColumns(table, columns) {
  const omitted = credentialColumns[table] || [];
  for (const {col} of columns) {
    if (secretName.test(col) && !omitted.includes(col) && !exportedNames.has(`${table}.${col}`)) refuse(`${table}.${col}`);
  }
  return columns.filter(({col}) => !omitted.includes(col));
}

function usageField(table, column, path, key, value) {
  // Provider accounting counts, never authentication material.
  const root = table === 'ai_usages' && column === 'usage' ? []
    : table === 'ai_logs' && column === 'response' ? ['usage'] : null;
  if (!root || !root.every((part,index) => path[index] === part)) return false;
  const rest = path.slice(root.length);
  if (rest.length > 1 || (rest.length === 1 && !usageContainers.has(rest[0]))) return false;
  if (!rest.length && usageContainers.has(key)) return value !== null && typeof value === 'object' && !Array.isArray(value);
  return usageCounters.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function secretString(value) {
  // Durable UUID references and their storage paths are identifiers, not opaque keys.
  value = value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'<uuid>');
  return /-----BEGIN [A-Z ]*(?:PRIVATE KEY|ENCRYPTED)/.test(value)
    || /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(value)
    || /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/.test(value)
    || /[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i.test(value)
    || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)
    || /(?:key|secret|token|password|hash|salt|credential|encrypt\w*)[\w-]*["']?\s*[:=]\s*["']?[^\s"',;}]+/i.test(value)
    || /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=-]{12,}/i.test(value)
    || /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}|\$argon2(?:id|i|d)\$/.test(value)
    || /\b[a-f0-9]{32,}\b/i.test(value)
    || /(?:^|[^A-Za-z0-9+/_-])(?=[A-Za-z0-9+/_-]{40,}={0,2}(?:$|[^A-Za-z0-9+/_=-]))(?=[A-Za-z0-9+/_-]*[A-Za-z])(?=[A-Za-z0-9+/_-]*\d)[A-Za-z0-9+/_-]{40,}={0,2}/.test(value);
}

/** Inspect structured values, JSON in TEXT, and free text. Errors never print values. */
export function classifyValue(table, column, value, path = []) {
  const location = `${table}.${column}`;
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const [index,item] of value.entries()) classifyValue(table,column,item,[...path,String(index)]);
  } else if (typeof value === 'object') {
    if ('iv' in value && 'value' in value && ('mac' in value || 'tag' in value)) refuse(location);
    for (const [key,item] of Object.entries(value)) {
      if (secretName.test(key) && !usageField(table,column,path,key,item)) refuse(location);
      classifyValue(table,column,item,[...path,key]);
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[\[{]/.test(trimmed)) {
      let parsed;
      try { parsed = JSON.parse(trimmed); } catch { /* Scan non-JSON prose below. */ }
      if (parsed !== undefined) { classifyValue(table,column,parsed,path); return; }
    }
    if (table === 'projects' && column === 'widget_settings_hash' && !path.length && checksum.test(value)) return;
    if (secretString(value)) refuse(location);
  }
}

/** Refuse old or edited snapshots that still contain omitted payloads. */
export function classifySnapshot(bundle) {
  for (const [table,rows] of Object.entries(bundle.tables || {})) {
    for (const row of rows) {
      const columns = Object.keys(row).map(col => ({col}));
      if (columns.some(({col}) => credentialColumns[table]?.includes(col))) refuse(table);
      classifyColumns(table,columns);
      for (const [column,value] of Object.entries(row)) classifyValue(table,column,value);
    }
  }
}
