import { randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
const file = await open('.dev.vars', 'wx', 0o600).catch(error => { if (error.code === 'EEXIST') { console.log('Existing .dev.vars retained.'); process.exit(0); } throw error; });
await file.writeFile(`H2H_BOOTSTRAP_TOKEN=${randomBytes(32).toString('hex')}\n`);
await file.close();
console.log('Created private .dev.vars. Read H2H_BOOTSTRAP_TOKEN locally for first-owner setup. Run pnpm db:migrate:local, then pnpm dev.');
