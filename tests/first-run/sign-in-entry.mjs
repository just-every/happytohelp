import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {audit} from './browser-kit.mjs';

/** Follow the delivered app's declared owner entry, then sign in with native identity. */
export async function declaredSignIn({page,origin,email,password,width,evidence,projectId}) {
 const artifact=JSON.parse(await readFile(new URL('../../delivery-artifact/happytohelp-worker-artifact.json',import.meta.url),'utf8'));
 const published=JSON.parse(await readFile(new URL('../../management/integration/deployment-spec.json',import.meta.url),'utf8'));
 assert.deepEqual(artifact.deploymentSpec,published,'the imported source and delivered app declare the same owner entry');
 const signIn=artifact.deploymentSpec.surfaces.app.signIn;
 const entry=new URL(signIn.path,origin);
 assert.ok(signIn.loginHint,'the delivered app supports an owner email hint');
 entry.searchParams.set('login_hint',` ${email.toUpperCase()} `);
 await page.goto(entry.href,{waitUntil:'networkidle'});
 const address=page.getByLabel('Email',{exact:true}),secret=page.getByLabel('Password',{exact:true});
 assert.equal(await address.inputValue(),email,'Open app email hint is normalized and prefilled');
 assert.equal(await secret.inputValue(),'','a hint supplies no password');
 assert.equal((await page.request.get(origin+'/api/identity/session')).status(),401,'a hint does not authenticate');
 await audit(page,evidence,`login-hint-${width}`);
 await address.fill('another-owner@example.test');
 assert.equal(await address.inputValue(),'another-owner@example.test','the hint remains editable');
 await address.fill(email);
 await secret.fill(password);
 await page.getByRole('button',{name:'Login',exact:true}).click();
 await page.waitForURL(url=>url.pathname===`/projects/${projectId}/activation`);
 const response=await page.request.get(origin+'/api/identity/session');
 assert.equal(response.status(),200);
 const session=await response.json();
 assert.equal(session.role,'owner');
 assert.equal(session.projectId,projectId);
}
