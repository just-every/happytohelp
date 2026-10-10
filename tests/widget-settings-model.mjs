import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {registerHooks} from 'node:module'
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&c.parentURL&&!/\.[cm]?[jt]sx?$/.test(s)){for(const extension of ['.js','.ts']){const u=new URL(s+extension,c.parentURL);if(existsSync(u))return n(u.href,c)}}return n(s,c)}})
const model=await import('../src/ui/dashboard/components/widget-settings/settingsModel.js')
const {defaultTheme,defaultText,defaultSettings}=await import('../src/modules/widget/js/context/defaults.js')
const names=['theme[avatar][background]','theme[input][message][color]','settings[show_glow][on_insight]','settings[show_glow][on_ai_typing]','text[message][button_send]','text[chat][return_title]']

test('the editor shows the widget defaults, which are the values the widget itself renders',()=>{
 const effective=model.effectiveSettings({},names)
 assert.equal(effective.theme.avatar.background,defaultTheme.avatar.background)
 assert.equal(effective.settings.show_glow.on_insight,true)
 assert.equal(effective.settings.show_glow.on_ai_typing,false)
 assert.equal(effective.text.message.button_send,defaultText.message.button_send)
 assert.notEqual(defaultText.message.button_send,'')
 assert.equal(defaultSettings.message.collect_attachments,true)
})

test('every default color is a six-digit hex value a color input can display',()=>{
 const walk=(object)=>Object.values(object).flatMap(value=>typeof value==='string'?[value]:walk(value))
 for(const color of walk(defaultTheme))assert.match(color,/^#[0-9a-f]{6}$/)
})

test('saved overrides win over defaults without disturbing other values',()=>{
 const saved={theme:{avatar:{background:'#123456'}},text:{message:{button_send:'Go'}},settings:{show_glow:{on_insight:false}}}
 const effective=model.effectiveSettings(saved,names)
 assert.equal(effective.theme.avatar.background,'#123456')
 assert.equal(effective.theme.input.message.color,defaultTheme.input.message.color)
 assert.equal(effective.text.message.button_send,'Go')
 assert.equal(effective.text.chat.return_title,defaultText.chat.return_title)
 assert.equal(effective.settings.show_glow.on_insight,false)
 assert.equal(saved.theme.input,undefined,'saved settings are not mutated')
})

test('legacy switch strings and shorthand colors display correctly',()=>{
 const effective=model.effectiveSettings({settings:{show_glow:{on_insight:'1',on_ai_typing:'1'}},theme:{avatar:{background:'#ABC'}}},names)
 assert.equal(effective.settings.show_glow.on_insight,true)
 assert.equal(effective.settings.show_glow.on_ai_typing,true)
 assert.equal(effective.theme.avatar.background,'#aabbcc')
})

test('saving without edits keeps stored settings exactly as they were',()=>{
 assert.deepEqual(model.settingsToSave({},{}),{})
 const saved={theme:{avatar:{background:'#123456'}},settings:{ai:{enabled:false}}}
 assert.deepEqual(model.settingsToSave(saved,{}),saved)
})

test('only edited fields are stored, and values equal to the default are removed',()=>{
 assert.deepEqual(model.settingsToSave({},{'theme[avatar][background]':'#ff0000','settings[show_glow][on_insight]':false}),{theme:{avatar:{background:'#ff0000'}},settings:{show_glow:{on_insight:false}}})
 const saved={theme:{avatar:{background:'#ff0000'}},text:{message:{button_send:'Go'}},settings:{ai:{enabled:false}}}
 assert.deepEqual(model.settingsToSave(saved,{'theme[avatar][background]':defaultTheme.avatar.background,'text[message][button_send]':''}),{settings:{ai:{enabled:false}}},'defaults and emptied text drop their overrides and empty parents are pruned')
 assert.deepEqual(model.settingsToSave({},{'settings[show_glow][on_insight]':true}),{},'turning a default-on switch back on stores nothing')
})

test('the preview receives edits laid over defaults, never blanks or black',()=>{
 const preview=model.previewSettings({},{'theme[avatar][background]':'#ff0000'})
 assert.equal(preview.theme.avatar.background,'#ff0000')
 assert.equal(preview.theme.input.send.background,defaultTheme.input.send.background)
 assert.equal(preview.text.message.button_send,defaultText.message.button_send)
 assert.equal(model.previewSettings({},{'text[message][button_send]':''}).text.message.button_send,defaultText.message.button_send)
})

 test('workspace accent stays inherited in editor and preview through unrelated edits',()=>{
 const brand={color:'#204b3a'},field='theme[input][send][background]';
 assert.equal(model.effectiveSettings({},[field],brand).theme.input.send.background,brand.color);
 const changes={'theme[avatar][background]':'#112233'};
 assert.deepEqual(model.settingsToSave({},changes,brand),{theme:{avatar:{background:'#112233'}}});
 assert.equal(model.previewSettings({},changes,brand).theme.input.send.background,brand.color);
 assert.equal(model.effectiveSettings({theme:{input:{send:{background:'#123456'}}}},[field],brand).theme.input.send.background,'#123456');
 assert.deepEqual(model.settingsToSave({theme:{input:{send:{background:'#123456'}}}},{[field]:brand.color},brand),{});
 });

test('preview and reloaded editor retain explicit overrides and inherit untouched workspace colors',()=>{
 const brand={color:'#204b3a'},saved={theme:{input:{send:{background:'#123456'}}}};
 const changes={'theme[chat][agent][background]':'#f2e8d4'};
 const stored=model.settingsToSave(saved,changes,brand);
 assert.deepEqual(stored,{theme:{input:{send:{background:'#123456'}},chat:{agent:{background:'#f2e8d4'}}}});
 for(const view of [model.previewSettings(saved,changes,brand),model.effectiveSettings(stored,[],brand)]){
  assert.equal(view.theme.input.send.background,'#123456');
  assert.equal(view.theme.button.closed.background,brand.color);
  assert.equal(view.theme.chat.agent.background,'#f2e8d4');
  assert.equal(view.brand.color,brand.color);
 }
 assert.deepEqual(saved,{theme:{input:{send:{background:'#123456'}}}},'preview and save leave the original settings intact');
});

test('restoring an inherited color removes its override in preview and follows later workspace changes',()=>{
 const brand={color:'#204b3a'},saved={theme:{input:{send:{background:'#123456'}}}};
 const changes={'theme[input][send][background]':brand.color};
 const stored=model.settingsToSave(saved,changes,brand);
 assert.deepEqual(stored,{});
 const preview=model.previewSettings(saved,changes,brand);
 assert.equal(preview.theme.input.send.background,brand.color);
 assert.equal(preview.theme.button.closed.background,brand.color);
 const reloaded=model.effectiveSettings(stored,[],{color:'#f2e8d4'});
 assert.equal(reloaded.theme.input.send.background,'#f2e8d4');
 assert.equal(reloaded.theme.button.closed.background,'#f2e8d4');
});
