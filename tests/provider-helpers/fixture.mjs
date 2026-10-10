import { mkdtemp, writeFile, symlink, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function providerFixture(scenario = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'h2h-provider-'));
  const target = new URL('./codex.mjs', import.meta.url).pathname;
  await chmod(target, 0o755);
  await symlink(target, join(directory, 'codex'));
  const path = join(directory, 'scenario.json');
  await writeFile(path, JSON.stringify(scenario));
  const previous = { PATH: process.env.PATH, H2H_PROVIDER_SCENARIO: process.env.H2H_PROVIDER_SCENARIO };
  process.env.PATH = directory + ':' + process.env.PATH;
  process.env.H2H_PROVIDER_SCENARIO = path;
  return { directory, path, async close() {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    await rm(directory, { recursive: true, force: true });
  } };
}
export const strictOutput = { status: 'completed', summary: 'Checked the requested state.', actions: [], reply_draft: '', attachment_ids: [], replies: [], follow_up_actions: [], verified: true, question: null };
