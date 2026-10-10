import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';

async function bounded(label, operation) {
 let timer;
 try {
  return await Promise.race([
   operation(),
   new Promise((_, reject) => {timer = setTimeout(() => reject(Error(`${label} did not finish within 60 seconds`)), 60000);}),
  ]);
 } finally {clearTimeout(timer);}
}

export function appearanceAudit(directory, records) {
 return async (page, name) => {
  let stage;
  const progress = async next => {
   stage = next;
   console.log(`Appearance audit ${name}: ${stage}`);
   await writeFile(join(directory, 'appearance-progress.json'), JSON.stringify({name, stage, time: new Date().toISOString()}, null, 2));
  };
  try {
   await progress('brand images');
   await page.addScriptTag({path: resolve('node_modules/axe-core/axe.min.js')});
   const images = page.locator('.help-center-logo,.help-center-welcome img,.happytohelp-brand-heading img,.happytohelp-welcome img');
   for (const img of await images.all()) if (await img.isVisible()) {
    await bounded(`${name} brand image`, () => img.evaluate(el => {
     if (!el.complete) return new Promise((ok, fail) => {el.onload = ok; el.onerror = () => fail(Error('Brand image failed to load'));});
     if (!el.naturalWidth) throw Error('Brand image has no pixels');
    }));
   }
   await progress('axe');
   const result = await bounded(`${name} axe scan`, () => page.evaluate(async () => {
    const r = await axe.run();
    return r.violations.filter(v => ['serious', 'critical'].includes(v.impact));
   }));
   await progress('screenshot');
   await page.screenshot({path: join(directory, name + '.png'), fullPage: true, timeout: 15000});
   records.push({name, violations: result});
   await writeFile(join(directory, 'axe.json'), JSON.stringify(records, null, 2));
   assert.deepEqual(result, [], name + ' serious/critical axe violations');
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' no horizontal overflow');
   await progress('complete');
  } catch (error) {
   console.error(`Appearance audit ${name} failed during ${stage}:`, error);
   await writeFile(join(directory, 'appearance-failure.json'), JSON.stringify({name, stage, error: error.stack}, null, 2));
   throw error;
  }
 };
}
