import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Execute the actual DOM helper; it contains no JSX and needs no bundle/runtime.
const source = await readFile(new URL('../src/modules/widget/js/includes/utils.jsx', import.meta.url), 'utf8');
const {openMetaTags, closeMetaTags} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('mobile opening permits zoom and restores existing or absent host metadata', () => {
  const previous = {window: globalThis.window, document: globalThis.document};
  try {
    for (const original of ['width=device-width, initial-scale=1, maximum-scale=5', null]) {
      const tags = new Map();
      const create = () => ({name: '', content: '', remove() {tags.delete(this.name);}});
      if (original !== null) {const tag = create(); tag.name = 'viewport'; tag.content = original; tags.set(tag.name, tag);}
      const theme = create(); theme.name = 'theme-color'; theme.content = '#123456'; tags.set(theme.name, theme);
      globalThis.window = {matchMedia: () => ({matches: true}), scrollTo() {}};
      globalThis.document = {body: {style: {}}, querySelector: selector => tags.get(selector.slice(10, -1)) || null,
        createElement: create, head: {appendChild: tag => tags.set(tag.name, tag)}};
      openMetaTags();
      const content = tags.get('viewport').content;
      assert.match(content, /interactive-widget=resizes-content/);
      assert.doesNotMatch(content, /maximum-scale|user-scalable/);
      closeMetaTags();
      assert.equal(tags.get('viewport')?.content ?? null, original);
      assert.equal(tags.get('theme-color').content, '#123456');
    }
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
  }
});
