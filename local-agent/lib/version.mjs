import { readFileSync } from 'node:fs';

// The packaged manifest is the connector's protocol identity.
export const AGENT_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
