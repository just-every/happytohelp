import test from 'node:test';
import assert from 'node:assert/strict';
import {reproducibleOutput} from '../scripts/delivery/reproducible-output.ts';

function plugin(root) {
  const instance = reproducibleOutput();
  instance.configResolved({root});
  return instance;
}

test('start manifest route paths become relative to the project root', () => {
  const instance = plugin('/builder/checkout');
  const code = 'export const tsrStartManifest = () => ({routes:{__root__:{filePath:"/builder/checkout/src/routes/__root.tsx",children:["/"]},"/":{filePath:"/builder/checkout/src/routes/index.tsx"}}})';
  const result = instance.transform.handler(code, '\0tanstack-start-manifest:v');
  assert.equal(result.code, 'export const tsrStartManifest = () => ({routes:{__root__:{filePath:"src/routes/__root.tsx",children:["/"]},"/":{filePath:"src/routes/index.tsx"}}})');
  assert.equal(instance.transform.handler('const path = "/builder/checkout/src/a.ts"', '/builder/checkout/src/a.ts'), undefined, 'other modules are untouched');
});

test('emitted chunks naming the build directory fail the build', () => {
  const instance = plugin('/builder/checkout/');
  const clean = {'index.js': {type: 'chunk', fileName: 'index.js', code: 'export default {}'}, 'wrangler.json': {type: 'asset', fileName: 'wrangler.json', source: '{"configPath":"/builder/checkout/wrangler.jsonc"}'}};
  assert.doesNotThrow(() => instance.generateBundle({}, clean));
  const leaking = {...clean, 'assets/a.js': {type: 'chunk', fileName: 'assets/a.js', code: 'const p = "/builder/checkout/src/a.ts"'}};
  assert.throws(() => instance.generateBundle({}, leaking), /assets\/a\.js contains the absolute build directory \/builder\/checkout\//);
});
