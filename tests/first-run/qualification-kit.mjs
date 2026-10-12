import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
export async function inspectState(page,records,evidence,name){
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=> (await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
 const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 records.push({name,violations,horizontalOverflow});
 await writeFile(join(evidence,'audits.json'),JSON.stringify(records,null,2));
 await page.screenshot({path:join(evidence,name+'.png'),fullPage:true});
}
// A smooth scroll (the widget's own scroll to the newest message, or a PageUp) keeps moving the region for
// many frames. Sampling or pressing a key mid-animation compares against a position that is still changing,
// and a PageDown that retargets a PageUp in flight can end below that sample; wait for real stillness first.
async function settled(page,handle){
 await page.waitForFunction(element=>{const now=element.scrollTop,state=element.__settle||(element.__settle={top:now,frames:0});state.frames=state.top===now?state.frames+1:0;state.top=now;return state.frames>=8},handle,{polling:'raf',timeout:15000});
 await handle.evaluate(element=>{delete element.__settle});
}
export async function keyboardScroll(page,locator,label){
 const overflow=await locator.evaluate(node=>node.scrollHeight>node.clientHeight);assert.equal(overflow,true,label+' really overflows');
 const name=await locator.evaluate(node=>node.getAttribute('aria-label')||(node.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>node.ownerDocument.getElementById(id)?.textContent||'').join(' ').trim());
 assert.equal(name,label,'the scrolling region has its visible content name');assert.equal(await locator.isVisible(),true);
 let focused=false;
 for(let index=0;index<90;index++){
  await page.keyboard.press('Tab');
  focused=await locator.evaluate(node=>node.getRootNode().activeElement===node);
  if(focused)break;
 }
 assert.equal(focused,true,label+' is reached by Tab');
 const outline=await locator.evaluate(node=>({style:getComputedStyle(node).outlineStyle,width:parseFloat(getComputedStyle(node).outlineWidth)}));
 assert.notEqual(outline.style,'none');assert.ok(outline.width>=2,label+' has a visible focus indicator');
 const handle=await locator.elementHandle();
 await settled(page,handle);const initial=await locator.evaluate(node=>node.scrollTop);
 if(initial>0){await page.keyboard.press('PageUp');await page.waitForFunction(({element,before})=>element.scrollTop<before,{element:handle,before:initial});await settled(page,handle);}
 const before=await locator.evaluate(node=>node.scrollTop);
 await page.keyboard.press('PageDown');await page.waitForFunction(({element,before})=>element.scrollTop>before,{element:handle,before});
 const top=await locator.evaluate(node=>node.scrollTop);assert.ok(top>before,label+' PageDown scrolls the focused region');
 assert.equal(await locator.evaluate(node=>node.getRootNode().activeElement===node),true);
 return {tabReachable:true,pageDownFrom:before,pageDownScrollTop:top,outline};
}
export function assertAudits(records){assert.ok(records.length>0);assert.deepEqual(records.filter(row=>row.violations.length||row.horizontalOverflow),[],'all actual states have zero serious/critical axe findings and no horizontal overflow');}
