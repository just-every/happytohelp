import { requireSha } from './policy.mjs';

// Owner-maintained Environment variable; never a dispatch input or build file.
// Provisioning and DNS changes remain separate owner operations.
export function targetPolicy(raw, sha) {
  let p;
  try { p = JSON.parse(raw); } catch { throw new Error('stage-target-unconfigured'); }
  const keys = ['schema', 'isolation', 'accountId', 'prefix', 'databaseId', 'origin', 'sourceSha', 'artifactSha256'];
  if (!p || Object.keys(p).length !== keys.length || keys.some(k => !Object.hasOwn(p, k)) ||
      p.schema !== 1 || p.isolation !== 'dedicated-stage' ||
      !/^[a-f0-9]{32}$/.test(p.accountId) || !/^[a-z][a-z0-9-]{2,33}-stage$/.test(p.prefix) ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(p.databaseId) ||
      !/^[a-f0-9]{64}$/.test(p.artifactSha256) || p.sourceSha !== requireSha(sha))
    throw new Error('invalid-stage-policy');
  // workers.dev only: no custom-domain/DNS authority in this workflow.
  if (typeof p.origin !== 'string' || !new RegExp(`^https://${p.prefix}\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.workers\\.dev$`).test(p.origin))
    throw new Error('invalid-stage-policy');
  return p;
}
