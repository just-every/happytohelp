import { mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRuntime } from './helpers/emitted-runtime.mjs';
import { checkSetupBrowser } from './helpers/setup-browser-flow.mjs';

const directory = process.env.H2H_EVIDENCE_DIR ? resolve(process.env.H2H_EVIDENCE_DIR) : await mkdtemp(join(tmpdir(), 'h2h-setup-browser-'));
const runtime = await createRuntime();
let success = false;
try {
    console.log(JSON.stringify(await checkSetupBrowser(runtime.origin, join(directory, 'setup-native'))));
    success = true;
} finally { await runtime.close(success); }
