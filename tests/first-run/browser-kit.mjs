import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
export async function freePort(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
export async function post(origin,path,body,token){const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});assert.ok(response.ok,`Native request ${path.split('?')[0]} returned ${response.status}`);return response.json();}
export async function audit(page,evidence,name,{mask=[]}={}){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} has no horizontal overflow`);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=> (await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target.map(part=>String(part).replace(/\[[^\]]*href[^\]]*\]/g,'[link]').replace(/[a-f0-9]{32,}/g,'[id]')),summary:n.failureSummary}))})));
 assert.deepEqual(violations,[],`${name} has no serious or critical axe findings`);
 await page.screenshot({path:join(evidence,name+'.png'),fullPage:true,mask});
}
export async function passwordLogin(page,origin,email,password,destination='/projects?onboarding=setup'){
 await page.goto(origin+'/login?returnTo='+encodeURIComponent(destination));
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Login',exact:true}).click();await page.waitForURL(url=>url.pathname!=='/login');
}
export async function firstOwner(page,origin,{email,password,width}){
 await page.goto(origin+'/setup?onboarding=setup');
 const known=page.getByRole('region',{name:'Known details'});await known.waitFor();
 assert.match(await known.innerText(),/Your website[\s\S]*Workspace address/);
 assert.doesNotMatch(await known.innerText(),/Cloudflare Worker|Runtime|Installation/);
 await page.getByLabel('Your name',{exact:true}).fill('Local owner');await page.getByLabel('Owner email',{exact:true}).fill(email);
 await page.getByLabel('Owner password',{exact:true}).fill(password);await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Workspace name').fill('Local support '+width);await page.getByLabel('Widget website origin').fill(origin);
 await page.getByRole('button',{name:'Review setup',exact:true}).click();await page.getByRole('button',{name:'Create workspace',exact:true}).click();
 await page.waitForURL(/\/projects\/[^/]+\/activation$/);return new URL(page.url()).pathname.split('/')[2];
}
