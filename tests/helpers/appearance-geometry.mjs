import assert from 'node:assert/strict';

export async function assertHelpSearchFits(page) {
 const size=await page.locator('.help-center-search input').evaluate(input=>{
  const style=getComputedStyle(input),canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  context.font=style.font;
  return {text:context.measureText(input.placeholder).width,available:input.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)};
 });
 assert.ok(size.available>=size.text+2,`full Help Center placeholder fits: ${JSON.stringify(size)}`);
}

export async function assertHelpSearchReachable(page) {
 const input=page.locator('.help-center-search input'),button=page.locator('.help-center-search button');
 for(const control of [input,button]){
  const reachable=await control.evaluate(element=>{
   const rect=element.getBoundingClientRect();
   return document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)===element;
  });
  assert.ok(reachable,'Help Center search remains reachable with open widget');
 }
 const search=await page.locator('.help-center-search').boundingBox(),panel=await page.locator('.happytohelp-chat-header-container').boundingBox();
 assert.ok(panel,'open widget has a header');
 assert.ok(search.x+search.width<=panel.x||search.x>=panel.x+panel.width||search.y+search.height<=panel.y||search.y>=panel.y+panel.height,`Help Center search and open widget header do not overlap: ${JSON.stringify({search,panel})}`);
}
