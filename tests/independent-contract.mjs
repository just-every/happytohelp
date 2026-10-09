import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectFiles} from '../scripts/build-delivery-artifact.mjs';
import {specInputs} from '../scripts/delivery/spec-inputs.mjs';
test('independent project declares isolated origins and protected owner setup',async()=>{
 const descriptor=JSON.parse(await readFile('rer-project.json'));
 assert.equal(descriptor.projectId,'just-every/happytohelp');
 assert.ok(descriptor.operations.setup.includes('setup-build'));
 assert.deepEqual(specInputs.secretNames,['H2H_SETUP_TOKEN']);
 assert.ok(!specInputs.optionalSecretNames.includes('H2H_SETUP_TOKEN'));
 assert.equal(specInputs.surfaces.app.originVariable,'APP_ORIGIN');
 assert.equal(specInputs.surfaces.websitePreview.originVariable,'PREVIEW_ORIGIN');
 const workflow=await readFile('.github/workflows/rer-managed.yml','utf8');
 assert.match(workflow,/build_profile: project/);assert.match(workflow,/trusted-build.yml@[a-f0-9]{40}/);
 const defaults=await readFile('src/modules/widget/js/context/AppContext.jsx','utf8');
 assert.ok(!defaults.includes('https://happytohelp.com'));
 const provider=await readFile('src/modules/ai-support/vendor/ensemble/model_providers/openrouter.js','utf8');
 assert.ok(!provider.includes('https://justevery.com'));
 const repositoryUrl=JSON.parse(await readFile('package.json','utf8')).repository.url;
 assert.ok(provider.includes(repositoryUrl));
});
test('artifact collection refuses a public symlink instead of reading outside source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'h2h-artifact-link-'));
 try{await mkdir(join(root,'assets'));await writeFile(join(root,'private'),'never publish');await symlink('../private',join(root,'assets','leak'));await assert.rejects(collectFiles(join(root,'assets')),/symlinks/)}finally{await rm(root,{recursive:true,force:true})}
});
