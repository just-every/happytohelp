import {readFile,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {artifactRuntime} from './helpers/independent-artifact.mjs';
import {checkSetupBrowser} from './helpers/setup-browser-flow.mjs';
const artifact=JSON.parse(await readFile('delivery-artifact/happytohelp-worker-artifact.json'));
const evidence=process.env.H2H_EVIDENCE_DIR||await mkdtemp(join(tmpdir(),'h2h-independent-browser-'));
const runtime=await artifactRuntime(artifact);
try{
 const result=await promisify(execFile)(process.execPath,['tests/homepage-browser.mjs'],{env:{...process.env,H2H_TEST_ORIGIN:runtime.origin,H2H_EVIDENCE_DIR:join(evidence,'homepage')}});console.log(result.stdout);
 console.log(JSON.stringify(await checkSetupBrowser(runtime.origin,join(evidence,'setup'))));
}finally{await runtime.close()}
