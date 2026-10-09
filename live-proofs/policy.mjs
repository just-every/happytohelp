export const repository = 'just-every/happytohelp';
export const integrationRef = 'refs/heads/main';
// The protected Environment selects receipt storage, never dispatch or candidate data.
export function evidenceRepository(value) {
  if (typeof value !== 'string' || value !== value.trim() ||
      !/^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*\.git$/.test(value))
    throw new Error('receipt-store-unconfigured');
  return value;
}
export const evidencePrefix = 'happytohelp-validation';
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
