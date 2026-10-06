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
 await page.goto(origin+'/setup');await page.getByLabel('Your name',{exact:true}).fill('Activation owner');await page.getByLabel('Owner email').fill('activation-browser@example.test');await page.getByLabel('Owner password',{exact:true}).fill('activation-browser-local-password');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Workspace name').fill('Fresh activation workspace');await page.getByRole('button',{name:'Review setup',exact:true}).click();await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.waitForURL(/\/projects\/[^/]+\/widget-settings$/);return new URL(page.url()).pathname.split('/')[2];
}
export async function noOverflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+' document overflow');const clipped=await page.locator('.activation-checklist a, .activation-checklist button, .activation-spend button').evaluateAll(elements=>elements.filter(element=>{const rect=element.getBoundingClientRect();return rect.width&&rect.height&&(rect.left< -1||rect.right>innerWidth+1)}).map(element=>element.textContent.trim()));assert.deepEqual(clipped,[],label+' checklist/spend controls clipped horizontally');}
export async function visibleControl(locator,label){assert.equal(await locator.count(),1,label+' single control');assert.ok(await locator.isVisible(),label+' visible');const box=await locator.boundingBox(),viewport=locator.page().viewportSize();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,label+' within viewport');}
export async function capture(page,evidence,name,artifacts){const path=join(evidence,name+'.jpg');await page.screenshot({path,type:'jpeg',quality:85,fullPage:true});artifacts.push({file:name+'.jpg',sha256:createHash('sha256').update(await readFile(path)).digest('hex'),url:page.url(),viewport:page.viewportSize()});}
export async function axeChecklist(page,evidence,name){
 const axePath=new URL('../../node_modules/axe-core/axe.min.js',import.meta.url).pathname;await page.addScriptTag({path:axePath});
 await page.locator('.activation-checklist').waitFor();assert.equal(await page.locator('.activation-checklist').count(),1,'one checklist audited');
 const result=await page.evaluate(async()=>window.axe.run(document.querySelector('.activation-checklist')));
 await writeFile(join(evidence,name+'.axe.json'),JSON.stringify(result,null,2));assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)),[],name+' serious/critical checklist issues');
}
