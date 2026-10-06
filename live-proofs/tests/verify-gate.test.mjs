import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, access, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('the actual prepare shell exits on failed verify before invoking artifact packaging',async()=>{
  const root=await mkdtemp(join(tmpdir(),'h2h-verify-gate-'));
  try {
    await mkdir(join(root,'bin'));
    // Command-boundary fixtures only: there is no pretend application in CI.
    await writeFile(join(root,'bin/pnpm'),'#!/bin/sh\nif [ "$*" = "run verify" ]; then exit 23; fi\nexit 0\n',{mode:0o755});
    await writeFile(join(root,'bin/node'),'#!/bin/sh\ntouch "$MARKER"\n',{mode:0o755});
    const yaml=await readFile('.github/workflows/deploy-stage.yml','utf8');
    const body=yaml.split('      - name: Verify then package native Worker\n')[1].split('        run: |\n')[1]
      .split('      - uses:')[0].split('\n').filter(Boolean).map(line=>line.slice(10)).join('\n');
    const marker=join(root,'packaged');
    const result=spawnSync('/bin/bash',['--noprofile','--norc','-e','-c',body],{cwd:root,env:{PATH:`${join(root,'bin')}:${process.env.PATH}`,HOME:root,MARKER:marker},encoding:'utf8'});
    assert.equal(result.status,23,`${result.stdout}\n${result.stderr}`);
    await assert.rejects(access(marker));
  } finally {await rm(root,{recursive:true,force:true});}
});
