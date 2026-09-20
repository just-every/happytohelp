import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('the selected component graph is acyclic and agrees with module contracts', async () => {
  const { components } = await json('edition.json');
  const byId = new Map(components.map(component => [component.id, component]));
  const done = new Set();
  function visit(id, ancestors = []) {
    assert(!ancestors.includes(id), `Component cycle: ${[...ancestors, id].join(' -> ')}`);
    assert(byId.has(id), `Unselected dependency: ${id}`);
    if (done.has(id)) return;
    for (const dependency of byId.get(id).requires || []) visit(dependency, [...ancestors, id]);
    done.add(id);
  }
  for (const component of components) {
    visit(component.id);
    const path = component.source.paths.find(path => path.startsWith('src/modules/'));
    if (component.role !== 'module' || !path) continue;
    const manifest = await json(`${path}/module.json`);
    assert.deepEqual(manifest.selectedEditionDependencies, component.requires);
  }
});

test('context and training engines bundle without optional execution capabilities', async () => {
  for (const [entry, forbidden] of [
    ['customer-context/engine.ts', /src\/(edition|modules\/(ai-support|training-runs|local-computer))\//],
    ['training-runs/index.ts', /src\/(edition|modules\/(ai-support|customer-context|local-computer|knowledge))\//],
  ]) {
    const result = await build({ entryPoints: [new URL(`src/modules/${entry}`, root).pathname], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm' });
    for (const input of Object.keys(result.metafile.inputs)) assert(!forbidden.test(input), `${entry} unexpectedly requires ${input}`);
    if (entry.startsWith('customer-context')) {
      const module = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
      // Missing wiring must fail before touching storage or claiming a persisted job.
      await assert.rejects(module.consumeContextJob({ type: 'context.run' }, {}), /explicit execution adapter/);
      assert.equal(await module.consumeContextJob({ type: 'other' }, {}), false);
    }
  }
});

test('the published neutral packet selection works outside the edition checkout', async () => {
  const manifest = await json('src/modules/ai-support/module.json');
  const folder = await mkdtemp(join(tmpdir(), 'h2h-packet-consumer-'));
  try {
    for (const path of manifest.neutralSourceSelection.paths) {
      const target = resolve(folder, path);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(new URL(path, root), target);
    }
    const { imageInputsForPacket, assistPacketMessageContent } = await import(pathToFileURL(join(folder, 'src/modules/ai-support/assist/packet.js')));
    const attachments = Array.from({ length: 5 }, (_, index) => ({ evidence_id: `image:${index}`, content_access: 'included-as-image', provider_image_url: `https://example.com/${index}.png` }));
    const packet = { timeline: [{ attachments }] };
    assert.equal(imageInputsForPacket(packet).length, 4);
    const content = assistPacketMessageContent(packet);
    assert.equal(content.filter(part => part.type === 'image_url').length, 4);
    assert.match(content[0].text, /image-input-budget-exhausted/);
    assert.match(content[0].text, /image:4/);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
