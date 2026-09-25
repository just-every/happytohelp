import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Keep plaintext secrets private and alive only for the awaited operation. */
export async function withSecretJsonFile(values, callback, { prefix = 'rer-deploy-secrets-' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  const path = join(directory, 'secrets.json')
  try {
    await writeFile(path, JSON.stringify(values), { mode: 0o600, flag: 'wx' })
    return await callback(path)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
