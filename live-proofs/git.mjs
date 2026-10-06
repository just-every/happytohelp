import { spawnSync } from 'node:child_process';
// Never surface git output: server errors can include credentials or private URLs.
export function git(cwd, args, { env = process.env, input, allowFailure = false } = {}) {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd, env, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    timeout: 120000,
  });
  if (result.status !== 0 && !allowFailure) throw new Error('git-operation-failed');
  return { ok: result.status === 0, text: result.stdout?.trim() ?? '' };
}
export function readAuthEnv(token, base = process.env) {
  return { ...base, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '',
    GIT_CONFIG_KEY_1: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_1: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}` };
}
