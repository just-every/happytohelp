import assert from 'node:assert/strict';
import {contrastRatio} from './accessibility-contrast.mjs';

/** Measure actual rendered foreground/background colors in every interactive link state. */
export async function assertHelpLinksReadable(page){
 const measurements=[];
 const links=page.locator('.help-center-nav a,.help-center-content a');
 assert.ok(await page.locator('.help-center-content a').count(),'page exercises white-surface links');
 for(const link of await links.all()){
  for(const state of ['default','hover','focus']){
   await page.mouse.move(0,0);
   await page.evaluate(()=>document.activeElement?.blur());
   if(state==='hover')await link.hover();
   if(state==='focus')await link.focus();
   const detail=await link.evaluate(element=>{
    let parent=element,background;
    while(parent){
     const value=getComputedStyle(parent).backgroundColor;
     if(value!=='transparent'&&value!=='rgba(0, 0, 0, 0)'){background=value;break;}
     parent=parent.parentElement;
    }
    return {text:element.textContent.trim(),foreground:getComputedStyle(element).color,background,focused:document.activeElement===element};
   });
   if(state==='focus')assert.ok(detail.focused,'link takes keyboard focus');
   const ratio=contrastRatio(detail.foreground,detail.background,null);
   assert.ok(ratio>=4.5,`${state} link contrast ${ratio}: ${JSON.stringify(detail)}`);
   measurements.push({state,...detail,ratio});
  }
 }
 await page.mouse.move(0,0);
 await page.evaluate(()=>document.activeElement?.blur());
 return measurements;
}
