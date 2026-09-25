/**
 * A remote Worker must never accept an unauthenticated first-owner claim.
 * Fresh installations deploy only with a private H2H_SETUP_TOKEN; redeploys of an
 * installation whose owner setup is already consumed may omit it.
 */
export const minimumSetupTokenLength = 32;
export const setupAvailabilitySql = 'SELECT (NOT EXISTS(SELECT 1 FROM owner_setup) AND NOT EXISTS(SELECT 1 FROM users) AND NOT EXISTS(SELECT 1 FROM projects)) AS available';
export const setupTokenGuidance = 'Generate one privately (for example: openssl rand -hex 32), export it as H2H_SETUP_TOKEN, deploy again, then enter it at /setup.';

export async function remoteSetupAvailable({ configPath, env, cwd, execute }) {
  const { stdout } = await execute(['exec', 'wrangler', 'd1', 'execute', 'DB', '--remote', '--config', configPath, '--json', '--command', setupAvailabilitySql], { env, cwd, capture: true });
  let available;
  try { available = JSON.parse(stdout)?.[0]?.results?.[0]?.available; } catch {}
  if (available !== 0 && available !== 1) throw new Error('Could not read first-owner setup state from the remote database. Nothing was deployed.');
  return available === 1;
}

export async function assertSetupCredential({ env, configPath, cwd, execute }) {
  const token = typeof env.H2H_SETUP_TOKEN === 'string' ? env.H2H_SETUP_TOKEN.trim() : '';
  if (token) {
    if (token.length < minimumSetupTokenLength) throw new Error(`H2H_SETUP_TOKEN must be at least ${minimumSetupTokenLength} characters. ${setupTokenGuidance}`);
    return { setupToken: 'configured' };
  }
  if (await remoteSetupAvailable({ configPath, env, cwd, execute })) {
    throw new Error(`This installation has no owner yet, so H2H_SETUP_TOKEN is required before its Worker is deployed. ${setupTokenGuidance} Nothing was deployed.`);
  }
  return { setupToken: 'not-required-owner-exists' };
}
