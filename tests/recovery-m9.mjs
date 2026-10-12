import assert from 'node:assert/strict';
import {mkdtemp, mkdir, cp, readFile, writeFile, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync, execFileSync} from 'node:child_process';
import {readArtifact} from './helpers/artifact-payloads.mjs';
import {sha256} from './helpers/recovery/snapshot.mjs';

// Normal verify builds first. Preserve the actual emitted payload closure and
// identify that artifact; this wrapper does not claim a second independent build.
const scratch=await mkdtemp(join(tmpdir(),'h2h-m9-recovery-'));
const output=process.env.H2H_EVIDENCE_DIR
  ? await mkdtemp(join(resolve(process.env.H2H_EVIDENCE_DIR),'m9-recovery-')) : scratch;
try {
  const build=join(scratch,'build');await mkdir(build);
  await cp('delivery-artifact',join(build,'delivery-artifact'),{recursive:true});
  const source=join(build,'delivery-artifact/happytohelp-worker-artifact.json');
  const artifact=await readArtifact(source),bytes=await readFile(source);
  await writeFile(join(build,'delivery-artifact/artifact.json'),bytes);
  await writeFile(join(build,'build.json'),JSON.stringify({
    sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),
    input:'actual current emitted Worker artifact from preceding build',artifactSha256:sha256(bytes),
    migrations:artifact.deploymentSpec.migrations.map(({name,sha256})=>({name,sha256})),
  }));
  const run=spawnSync(process.execPath,['tests/recovery-comparison.mjs','first-run',build,join(output,'proof')],{stdio:'inherit',env:process.env});
  assert.equal(run.status,0,'M9 native recovery failed');
} finally {await rm(scratch,{recursive:true,force:true});}
