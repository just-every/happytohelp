import { run } from './run.mjs';
import { withSecretJsonFile } from './secret-json.mjs';
import { waitForDeploymentHealth } from './health.mjs';
import { runtimeSecrets, validateRuntimeEnvironment } from './environment.mjs';
import { assertSetupCredential } from './setup-credential.mjs';

/** Upload the built Worker after its migrations; refuse a claimable fresh installation first. */
export async function deployRemote({ env, cwd, configPath, origin, execute = run, waitForHealth = waitForDeploymentHealth }) {
  validateRuntimeEnvironment(env);
  const credential = await assertSetupCredential({ env, configPath, cwd, execute });
  await withSecretJsonFile(runtimeSecrets(env), path => execute(['exec', 'wrangler', 'deploy', '--config', configPath, '--secrets-file', path], { env, cwd }));
  await waitForHealth(origin + '/health');
  return credential;
}
