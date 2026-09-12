import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const child=spawnSync(process.execPath,[fileURLToPath(new URL('./deploy.mjs',import.meta.url)),'--setup-only',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
if(child.error) throw child.error;
process.exit(child.status ?? 1);
