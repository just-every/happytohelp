import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.H2H_PLAYWRIGHT_MODULE||'playwright');
import {createRuntime} from './helpers/emitted-runtime.mjs';

// Widget settings must show what the widget renders, edit one value at a time, save only edits,
// and every project must have a server secret that its owner can reveal and copy.
const defaults={
 theme:{'avatar][background':'#b2e2ff','insight][background':'#ffffff','insight][color':'#333333','button][open][color':'#667085','button][open][background':'#f5f6fb','button][closed][color':'#ffffff','button][closed][background':'#484748','window][background':'#ffffff','window][color':'#000000','chat][agent][background':'#f1f9ff','chat][agent][color':'#000000','chat][user][background':'#2ca1e5','chat][user][color':'#ffffff','input][message][background':'#f5f6fb','input][message][color':'#666666','input][send][background':'#484748','input][send][color':'#ffffff','input][button][color':'#667085'},
};
const color=name=>`input[name="theme[${name}]"]`;
const themeDefaults=Object.fromEntries(Object.entries(defaults.theme).map(([name,value])=>[color(name),value]));
const textDefaults={'text[message][placeholder_message]':'Send a message...','text[message][button_send]':'Send','text[chat][return_title]':'Continue Conversation','text[chat][return_last_message]':'Last message','text[chat][sending_images]':'Sending images...','text[errors][connection]':'Sorry we could not connect to the server. Please check your connection and try again.','text[prompt][email_prompt]':'Receive an email when {agent_name} replies!','text[ai][human_response]':'Responds within 24 hours'};
const switchDefaults={'settings[show_glow][on_insight]':true,'settings[show_glow][on_insight_reply]':true,'settings[show_glow][on_ai_typing]':false,'settings[show_glow][on_human_typing]':false,'settings[message][collect_screenshot]':true,'settings[message][collect_attachments]':true,'settings[collect][require_name]':false,'settings[collect][require_email]':false};

const evidenceDir=join(process.env.H2H_EVIDENCE_DIR?resolve(process.env.H2H_EVIDENCE_DIR):await mkdtemp(join(tmpdir(),'h2h-widget-settings-evidence-')),'widget-settings');
await mkdir(evidenceDir,{recursive:true});console.log('Widget settings evidence:',evidenceDir);
const runtime=await createRuntime({port:Number(process.env.H2H_TEST_PORT||0)});const origin=runtime.origin;let success=false;
const call=async(path,body,token,method=body===undefined?'GET':'POST')=>{const r=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(r.ok,`${path}: ${r.status}`);return r.json()};
const f={email:'widget-settings@example.test',password:'widget-settings-test-password-2026'};
const setup=await call('/api/identity/bootstrap',{password:f.password,name:'Widget Settings Workspace',email:f.email,allowedOrigin:origin});
const owner=await call('/api/identity/login',{email:f.email,password:f.password});
const settingsApi=(projectId=setup.projectId)=>call(`/api/management/projects/${projectId}/widget-settings`,undefined,owner.token);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();
const errors=[],puts=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/management/projects/*/widget-settings',async route=>{const request=route.request();if(request.method()==='PUT')puts.push(JSON.parse(request.postData()));await route.continue()});
const preview=page.locator('#happytohelp');
const previewStyle=(selector,property)=>preview.locator(selector).first().evaluate((element,name)=>getComputedStyle(element)[name],property);
const open=async()=>{await page.goto(`${origin}/projects/${setup.projectId}/widget-settings`);await page.locator('#widget-settings-tabs').waitFor();await preview.locator('.happytohelp-send-message-conversation').waitFor({state:'attached'})};
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const save=async()=>{const before=puts.length;await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved.'}).waitFor();assert.equal(puts.length,before+1);return puts.at(-1)};
const value=selector=>page.locator(selector).inputValue();
const assertThemeDefaults=async(except={})=>{for(const [selector,expected] of Object.entries(themeDefaults))assert.equal(await value(selector),except[selector]??expected,selector)};
const checks=[];
try{
 await page.goto(origin+'/login');await page.getByLabel('Email',{exact:true}).fill(f.email);await page.getByLabel('Password',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL(/\/conversations/);

 // A project made by setup already has a server secret and no saved widget settings.
 const initial=await settingsApi();assert.deepEqual(initial.settings,{});assert.match(initial.verificationSecret,/^[0-9a-f]{64}$/);checks.push('setup project has a 256-bit server secret');
 const second=await call('/api/management/projects',{name:'Second project',allowed_origin:'https://second.example.test'},owner.token);
 const secondSettings=await settingsApi(second.id);assert.match(secondSettings.verificationSecret,/^[0-9a-f]{64}$/);assert.notEqual(secondSettings.verificationSecret,initial.verificationSecret);checks.push('created project has its own server secret');

 await open();
 // Code tab: the secret can be revealed and copied.
 const reveal=page.getByRole('button',{name:'Reveal server secret'}),copy=page.getByRole('button',{name:'Copy server secret'});
 assert.equal(await reveal.isEnabled(),true);assert.equal(await copy.isEnabled(),true);
 await page.screenshot({path:join(evidenceDir,'desktop-code-secret.png'),fullPage:true});
 await reveal.click();await page.locator('.widget-code__secret-value code').filter({hasText:initial.verificationSecret}).waitFor();
 await copy.click();await page.locator('.widget-code__copy-feedback').filter({hasText:/\S/}).waitFor();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),initial.verificationSecret);
 await page.getByRole('button',{name:'Hide server secret'}).click();await page.locator('.widget-code__secret-value code').filter({hasText:'••••'}).waitFor();checks.push('Reveal and Copy secret work for the owner');

 // Theme tab: effective defaults, not black.
 await tab('Theme');await assertThemeDefaults();await page.screenshot({path:join(evidenceDir,'desktop-theme-defaults.png'),fullPage:true});checks.push('all 18 theme swatches show widget defaults');
 // The preview renders the same defaults and shows the project agent in its header.
 assert.equal(await previewStyle('button[name=submit]','backgroundColor'),'rgb(72, 71, 72)');
 assert.match(await preview.locator('.happytohelp-chat-header').first().innerText(),/Widget Settings Workspace|widget-settings/i);checks.push('preview header shows the project agent');

 // Texts and Settings tabs show effective values.
 await tab('Texts');const texts=page.locator('.tab-pane.active input[type=text]');assert.equal(await texts.count(),35);
 for(const input of await texts.all()){assert.notEqual(await input.inputValue(),'',await input.getAttribute('name'));assert.equal(await input.getAttribute('placeholder'),await input.inputValue(),await input.getAttribute('name'))}
 for(const [name,expected] of Object.entries(textDefaults))assert.equal(await value(`input[name="${name}"]`),expected,name);
 await page.screenshot({path:join(evidenceDir,'desktop-texts-defaults.png'),fullPage:true});
 await tab('Settings');for(const [name,expected] of Object.entries(switchDefaults))assert.equal(await page.locator(`input[name="${name}"]`).isChecked(),expected,name);
 await page.screenshot({path:join(evidenceDir,'desktop-settings-defaults.png'),fullPage:true});checks.push('texts show default copy and settings toggles show default state');

 // Saving without edits stores nothing and leaves the widget on its defaults.
 assert.deepEqual(await save(),{});assert.deepEqual((await settingsApi()).settings,{});checks.push('save without edits stores no overrides');
 await open();await tab('Theme');await assertThemeDefaults();

 // One edit changes one value, in the form and in the preview.
 await tab('Theme');await page.locator(color('avatar][background')).fill('#ff0000');
 await assertThemeDefaults({[color('avatar][background')]:'#ff0000'});
 assert.equal(await previewStyle('button[name=submit]','backgroundColor'),'rgb(72, 71, 72)');
 assert.equal(await previewStyle('textarea','backgroundColor'),'rgb(245, 246, 251)');
 assert.equal(await previewStyle('.happytohelp-agent-avatar','backgroundColor'),'rgb(255, 0, 0)');
 await page.screenshot({path:join(evidenceDir,'desktop-theme-one-edit.png'),fullPage:true});checks.push('one color edit leaves every other color and the preview composer on defaults');

 // Save the edit with a text change and a switched-off default-on toggle.
 await tab('Texts');await page.locator('input[name="text[message][button_send]"]').fill('Deliver');
 await tab('Settings');await page.locator('input[name="settings[show_glow][on_insight]"]').uncheck();
 const expected={theme:{avatar:{background:'#ff0000'}},text:{message:{button_send:'Deliver'}},settings:{show_glow:{on_insight:false}}};
 assert.deepEqual(await save(),expected);assert.deepEqual((await settingsApi()).settings,expected);checks.push('save stores exactly the edited fields across all three tabs');
 await open();await tab('Theme');await assertThemeDefaults({[color('avatar][background')]:'#ff0000'});
 await tab('Texts');assert.equal(await value('input[name="text[message][button_send]"]'),'Deliver');assert.equal(await value('input[name="text[message][placeholder_message]"]'),'Send a message...');
 await tab('Settings');for(const [name,fallback] of Object.entries(switchDefaults))assert.equal(await page.locator(`input[name="${name}"]`).isChecked(),name==='settings[show_glow][on_insight]'?false:fallback,name);
 assert.deepEqual(await save(),expected);checks.push('reload keeps edits and defaults, and saving again changes nothing');

 // Putting a value back to the default, or emptying a text, removes the override.
 await tab('Theme');await page.locator(color('avatar][background')).fill('#b2e2ff');
 await tab('Texts');await page.locator('input[name="text[message][button_send]"]').fill('');
 assert.deepEqual(await save(),{settings:{show_glow:{on_insight:false}}});assert.deepEqual((await settingsApi()).settings,{settings:{show_glow:{on_insight:false}}});checks.push('restoring a default or clearing a text removes the override');

 // Mobile: the secret and tabs work at phone width.
 await page.setViewportSize({width:390,height:844});await open();
 assert.equal(await page.getByRole('button',{name:'Reveal server secret'}).isEnabled(),true);
 await page.screenshot({path:join(evidenceDir,'mobile-code-secret.png'),fullPage:true});
 await tab('Theme');await assertThemeDefaults();await page.screenshot({path:join(evidenceDir,'mobile-theme-defaults.png'),fullPage:true});checks.push('mobile layout shows the secret and default theme');
 assert.deepEqual(errors,[]);success=true;
}finally{await browser.close();await runtime.close(success);console.log(JSON.stringify({checks,errors}))}
