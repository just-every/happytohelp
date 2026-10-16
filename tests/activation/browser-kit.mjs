import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export const stepIds=['owner_mail','sender_dns','inbound_address','model_key','spend_ceilings','published_article','widget_origin','widget_seen'];
export function snapshot(value){
 const data=value.data;assert.ok(data,'activation response has data');
 assert.equal(data.total,8);assert.deepEqual(data.steps.map(s=>s.id),stepIds);
 assert.equal(data.done,data.steps.filter(s=>s.state==='done').length);
 for(const step of data.steps){assert.ok(['not_checked','checking','pending','done','failed','unavailable','unknown'].includes(step.state),step.id);assert.equal(typeof step.detail,'string');if(step.state==='done'){assert.ok(step.checkedAt,step.id+' checked time');assert.ok(step.receiptRef,step.id+' receipt');}}
 return data;
}
export function apiKit(runtime,token){
 return async(path,{body,method=body===undefined?'GET':'POST',auth=token,status=200,headers={}}={})=>{
 const response=await fetch(runtime.origin+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();assert.equal(response.status,status,`${method} ${path}: ${text}`);return text?JSON.parse(text):null;
 };
}
export async function setup(page,origin){
 // The one-screen first-run form: email, password, website. Name and colour are derived; the owner lands on the Setup page.
 await page.goto(origin+'/setup');await page.getByLabel('Your email',{exact:true}).fill('activation-browser@example.test');await page.getByLabel('Password',{exact:true}).fill('synthetic-activation-browser-local-password');
 await page.getByLabel('Your website',{exact:true}).fill(origin);
 // The URL commits before the Setup page mounts. Return once it has read its snapshot and finished its own automatic check,
 // so its requests are never attributed to the next page.
 const autoCheck=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/activation/check')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.waitForURL(/\/projects\/[^/]+\/activation$/);
 await page.locator('.setup-list[data-applicable]:visible').first().waitFor();await autoCheck;
 return new URL(page.url()).pathname.split('/')[2];
}
export async function noOverflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' document overflow');const clipped=await page.locator('.setup-list a, .setup-list button, .activation-spend button').evaluateAll(elements=>elements.filter(element=>{const rect=element.getBoundingClientRect();return rect.width&&rect.height&&(rect.left< -1||rect.right>innerWidth+1)}).map(element=>element.textContent.trim()));assert.deepEqual(clipped,[],label+' setup list/spend controls clipped horizontally');}
export async function visibleControl(locator,label){assert.equal(await locator.count(),1,label+' single control');assert.ok(await locator.isVisible(),label+' visible');const box=await locator.boundingBox(),viewport=locator.page().viewportSize();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,label+' within viewport');}
export async function capture(page,evidence,name,artifacts){const path=join(evidence,name+'.jpg');await page.screenshot({path,type:'jpeg',quality:85,fullPage:true});artifacts.push({file:name+'.jpg',sha256:createHash('sha256').update(await readFile(path)).digest('hex'),url:page.url(),viewport:page.viewportSize()});}
export async function axeChecklist(page,evidence,name){
 const axePath=new URL('../../node_modules/axe-core/axe.min.js',import.meta.url).pathname;await page.addScriptTag({path:axePath});
 await page.locator('.setup-list[data-applicable]:visible').first().waitFor();assert.equal(await page.locator('.setup-list:visible').count(),1,'one visible setup list audited');
 const result=await page.evaluate(async()=>window.axe.run([...document.querySelectorAll('.setup-list')].find(node=>node.offsetParent)));
 await writeFile(join(evidence,name+'.axe.json'),JSON.stringify(result,null,2));assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)),[],name+' serious/critical checklist issues');
}
// The empty inbox's start block: the one visible block is audited the way the Setup list is.
export async function axeInboxStart(page,evidence,name){
 const axePath=new URL('../../node_modules/axe-core/axe.min.js',import.meta.url).pathname;await page.addScriptTag({path:axePath});
 assert.equal(await page.locator('[data-testid="inbox-start"]:visible').count(),1,'one visible start block audited');
 const result=await page.evaluate(async()=>window.axe.run([...document.querySelectorAll('[data-testid="inbox-start"]')].find(node=>node.offsetParent)));
 await writeFile(join(evidence,name+'.axe.json'),JSON.stringify(result,null,2));assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)),[],name+' serious/critical start-block issues');
}
