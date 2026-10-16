import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRuntime} from '../emitted-runtime.mjs';
import {launchBrowser} from '../../journeys/kit/browser.mjs'

export async function visualHydration(){

const root = fileURLToPath(new URL('../../../', import.meta.url));
const path = new URL('../../../src/editor/visual-edits.json', import.meta.url);
const original = await readFile(path, 'utf8');
let browser, runtime, changed = false, success = false;
const build = () => {
  const result = spawnSync('pnpm', ['run', 'build'], {cwd:root, stdio:'inherit'});
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Hydration regression build failed');
};
try {
  browser = await launchBrowser();
  runtime = await createRuntime();
  // Read the real server-rendered heading without executing existing compiled edits.
  const baselineContext = await browser.newContext({javaScriptEnabled:false});
  const baseline = await baselineContext.newPage();
  await baseline.goto(runtime.origin + '/login');
  await baseline.locator('h1').waitFor();
  const target = await baseline.locator('h1').evaluate(element => {
    const parts = [];
    for (let node = element; node; node = node.parentElement) {
      const siblings = node.parentElement ? [...node.parentElement.children] : [node];
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${siblings.indexOf(node) + 1})`);
    }
    return {selector:parts.join(' > '), tag:'h1', role:element.getAttribute('role') || '', beforeText:element.textContent.replace(/\s+/g, ' ').trim()};
  });
  await baselineContext.close();
  await runtime.close(true);
  runtime = undefined;
  // Test-only fixture. Always restore exact source bytes and rebuild the real snapshot.
  const snapshot = {revision:1, edits:[{id:'hydration_probe', revision:1, path:'/login', target, change:{text:'Owner sign in', styles:{color:'#123456'}}}]};
  changed = true;
  await writeFile(path, JSON.stringify(snapshot, null, 2) + '\n');
  build();
  runtime = await createRuntime();
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const check = async () => {
    await page.getByRole('heading', {name:'Owner sign in', exact:true}).waitFor();
    assert.equal(await page.locator('h1').evaluate(element => element.style.color), 'rgb(18, 52, 86)');
  };
  await page.goto(runtime.origin + '/login');
  await check();
  await page.reload();
  await check();
  await page.locator('a[href="/forgot-password"]').click();
  await page.waitForURL('**/forgot-password');
  await page.goBack();
  await check();
  assert.deepEqual(errors, [], 'Hydration must not produce browser errors');
  success = true;
  console.log(JSON.stringify({success, checks:['real SSR heading compiled after leaf hydration', 'text and styles survive reload and forgot-password/Back', 'zero browser console/page errors']}));
} finally {
  try {
    try { await browser?.close(); } finally { await runtime?.close(success); }
  } finally {
    if (changed) { await writeFile(path, original); build(); }
  }
}

}
