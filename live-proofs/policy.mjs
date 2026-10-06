export const repository = 'just-every/support-happytohelp';
export const integrationRef = 'refs/heads/release/0.2.x';
export const evidenceRepository = 'https://github.com/runeditrun/evidence.git';
export const evidencePrefix = '3-foundation/T-002b';
export const providerSecrets = ['CLOUDFLARE_API_TOKEN', 'H2H_SETUP_TOKEN'];
export const proofs = Object.freeze({ 'secrets-present': true });
export const releaseRefPattern = /^refs\/tags\/v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9][A-Za-z0-9.-]*)?$/;
export function requireSha(value) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) throw new Error('invalid-sha');
  return value;
}
export function requireProof(value) {
  if (!Object.hasOwn(proofs, value)) throw new Error('unknown-proof');
  return value;
}
