import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

// Project mode supplies Node, but intentionally supplies no edition tooling.
// Keep this project's declared package manager inside the candidate workspace.
const run=(file,args)=>execFileSync(file,args,{stdio:'inherit'});
run('npm',['install','--prefix','.rer-tools','--no-package-lock','--ignore-scripts','--no-audit','--no-fund','pnpm@10.12.4']);
const pnpm=resolve('.rer-tools/node_modules/pnpm/bin/pnpm.cjs');
run(process.execPath,[pnpm,'install','--frozen-lockfile']);
run(process.execPath,[pnpm,'exec','playwright','install','--with-deps','chromium']);
