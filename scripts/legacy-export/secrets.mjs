import {hasCredentialAssignment} from './text-policy.mjs';
import {credentialColumns,skippedTables,structuredOmissions} from './scope.mjs';

const secretName = /key|secret|token|password|hash|salt|credential|encrypt/i;
// Exact reviewed noncredential fields, never an entire JSON/text exception.
const exportedNames = new Set([
  'projects.widget_settings_hash', // widget cache checksum
  'media.object_key', // exporter-generated storage path; also checked by enrichMedia
]);
const checksum = /^[a-f0-9]{32}$/i;
const usageCounters = new Set([
  'prompt_tokens','completion_tokens','total_tokens','input_tokens','output_tokens',
  'cached_tokens','cache_write_tokens','cache_write_1h_tokens','cache_read_input_tokens','cache_creation_input_tokens','reasoning_tokens','audio_tokens','accepted_prediction_tokens','rejected_prediction_tokens',
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
    : null;
  if (!root || !root.every((part,index) => path[index] === part)) return false;
  const rest = path.slice(root.length);
  if (rest.length > 1 || (rest.length === 1 && !usageContainers.has(rest[0]))) return false;
  if (!rest.length && usageContainers.has(key)) return value !== null && typeof value === 'object' && !Array.isArray(value);
  return usageCounters.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function basicAuthorization(value){
  if(/\bAuthorization\s*:\s*Basic\s+\S+/i.test(value))return true;
  for(const match of value.matchAll(/\bBasic\s+([A-Za-z0-9+/]+={0,2})/gi)){
    const bytes=Buffer.from(match[1],'base64');
    if(bytes.toString('base64').replace(/=+$/,'')===match[1].replace(/=+$/,'')&&bytes.includes(0x3a))return true;
  }
  return false;
}
function opaquePayload(value){
  const counts=new Map();for(const char of value)counts.set(char,(counts.get(char)||0)+1);
  let entropy=0;for(const n of counts.values()){const p=n/value.length;entropy-=p*Math.log2(p);}
  // Flattened page navigation and descriptive slugs are not encoded payloads.
  // Credential signatures and named assignments are checked independently.
  return entropy>4.8;
}
function secretString(value, storageIdentifier = false) {
  // Absolute local file/run paths are references. Keep all strong credential
  // signatures on the original text; only the generic opaque/hash checks ignore paths.
  const withoutPaths=value.replace(/(^|[\s\"'`(])\/(?:Users|home|tmp|private|var|workspace|mnt|opt|app|usr|root)\/[^\s\"'`<>)]+/g,'$1<file-path>');
  // Inspect URL path components separately: joining a hostname and several
  // descriptive segments does not turn them into one opaque credential.
  const references=withoutPaths.replace(/https?:\/\/[^\s<>"')]+/g,raw=>{
    try{const url=new URL(raw);if(url.username||url.password||url.search||url.hash)return raw;
      const path=url.pathname;
      if(['storage.happytohelp.com','images.12ui.com'].includes(url.hostname)&&/\.(?:webp|png|jpe?g|gif|svg)$/i.test(path))return '<public-image-path>';
      return url.hostname.replaceAll('.',' ')+path.replaceAll('/',' ');
    }catch{return raw;}
  });
  const opaque=references.replace(/(?<![a-f0-9])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![a-f0-9])/gi,'<uuid>');
  return /-----BEGIN [A-Z ]*(?:PRIVATE KEY|ENCRYPTED)/.test(value)
    || /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(value)
    || /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/.test(value)
    || /[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i.test(value)
    || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)
    || hasCredentialAssignment(value)
    || /\bBearer\s+[A-Za-z0-9+/_.=-]{12,}/i.test(value) || basicAuthorization(value)
    || /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}|\$argon2(?:id|i|d)\$/.test(value)
    || !storageIdentifier && /\b[a-f0-9]{32,}\b/i.test(opaque)
    || !storageIdentifier && [...opaque.matchAll(/[A-Za-z0-9+/_-]{40,}={0,2}/g)].some(m=>/[A-Za-z]/.test(m[0])&&/\d/.test(m[0])&&opaquePayload(m[0]));
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
    if(table==='media'&&['filename','directory'].includes(column)&&!path.length&&!/[\\\x00-\x1f\x7f]/.test(value)&&!secretString(value,true))return;
    // AI profile evidence fingerprints are cache checksums, not credentials.
    if (['projects','users','contacts','project_optimizations'].includes(table) && column==='ai_profile' && path.join('.')==='_profile_meta.evidence_fingerprint' && /^[a-f0-9]{64}$/i.test(value)) return;
    if(table==='contacts'&&column==='metadata'&&path.join('.')==='optimized_content_fingerprint'&&/^[a-f0-9]{64}$/i.test(value))return;
    // Public, unsigned object paths contain content-hash filenames. Restrict the
    // exact columns and bucket hostname; signed/authenticated URLs still fail.
    if (['projects.avatar_url','users.avatar_url','ais.avatar_url','contacts.avatar_url','media.url'].includes(location) && !path.length) {
      try {const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='storage.happytohelp.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/[A-Za-z0-9_./%~-]+$/.test(url.pathname)&&!secretString(url.pathname.replace(/\b[a-f0-9]{32,64}\b/gi,'content')))return;}catch{}
    }
    if (column==='avatar_url' && ['projects','users','ais','contacts'].includes(table) && !path.length) {
      try {const url=new URL(value);if(url.protocol==='https:'&&['secure.gravatar.com','www.gravatar.com','gravatar.com'].includes(url.hostname)&&!url.username&&!url.password&&!url.hash&&/^\/avatar\/(?:[a-f0-9]{32}|[a-f0-9]{64})(?:\.jpg)?$/i.test(url.pathname)&&[...url.searchParams].every(([key,v])=>key==='s'?/^\d{1,4}$/.test(v):key==='r'?/^(g|pg|r|x)$/.test(v):key==='d'&&/^(404|mp|mm|identicon|monsterid|wavatar|retro|robohash|blank)$/.test(v)))return;}catch{}
    }
    if (secretString(value)) refuse(location);
  }
}

/** Explicitly classified nested credentials, before content validation. */
export function omitStructured(table,column,value){
  const paths=structuredOmissions[table]?.[column];if(!paths)return {value,omitted:0};
  const encoded=typeof value==='string';let parsed=value;
  if(encoded){try{parsed=JSON.parse(value);}catch{return {value,omitted:0};}}
  let omitted=0;
  for(const path of paths){let parent=parsed;for(const key of path.slice(0,-1))parent=parent?.[key];const key=path.at(-1);if(parent&&typeof parent==='object'&&Object.hasOwn(parent,key)){delete parent[key];omitted++;}}
  return {value:encoded?(omitted?JSON.stringify(parsed):value):parsed,omitted};
}

/** Refuse old or edited snapshots that still contain omitted payloads. */
export function classifySnapshot(bundle) {
  for (const [table,rows] of Object.entries(bundle.tables || {})) {
    if(skippedTables.includes(table)&&rows.length)refuse(table);
    for (const row of rows) {
      const columns = Object.keys(row).map(col => ({col}));
      if (columns.some(({col}) => credentialColumns[table]?.includes(col))) refuse(table);
      classifyColumns(table,columns);
      for (const [column,value] of Object.entries(row)){if(structuredOmissions[table]?.[column]&&omitStructured(table,column,structuredClone(value)).omitted)refuse(`${table}.${column}`);classifyValue(table,column,value);}
    }
  }
}
