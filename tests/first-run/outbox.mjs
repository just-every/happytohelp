import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openIdentityDb} from '../helpers/identity-db.mjs';
import {createD1DevelopmentOutbox,createDevelopmentOutboxHandler} from '../../src/vendor/base/modules/mail/src/development/index.mjs';

test('Base outbox retention and safe viewer operate on native D1',async()=>{
 const db=await openIdentityDb();let now=10000;
 try{
  for(const sql of (await readFile(new URL('../../migrations/117_development_outbox.sql',import.meta.url),'utf8')).split(';').filter(x=>x.trim()))await db.DB.prepare(sql).run();
  const outbox=createD1DevelopmentOutbox({db:db.DB,maxMessages:2,maxAgeMs:1000,clock:()=>now});
  const message={deliveryId:'retention',from:'support@localhost.test',to:['person@example.test'],subject:'<script>unsafe</script>',text:'<img src=x onerror=alert(1)> https://example.test/guide',attachments:[{filename:'bytes.bin',contentType:'application/octet-stream',content:new Uint8Array([0,255,10])}]};
  await outbox.put({...message,deliveryId:'one'});await outbox.put({...message,deliveryId:'two'});await outbox.put({...message,deliveryId:'three'});
  const messages=await outbox.list();assert.deepEqual(messages.map(row=>row.message.deliveryId),['three','two']);
  assert.equal((await db.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).n,2);
  assert.deepEqual((await outbox.get(messages[0].id)).message.attachments[0].content,new Uint8Array([0,255,10]));
  const origin='http://127.0.0.1:8787',handler=createDevelopmentOutboxHandler({local:true,origin,outbox});
  const response=await handler(new Request(origin+'/__dev/outbox?message='+messages[0].id,{headers:{Host:'127.0.0.1:8787'}}));
  assert.equal(response.status,200);const html=await response.text();assert.ok(!html.includes('<img src=x'));assert.match(html,/&lt;img/);assert.match(html,/Open this link/);assert.ok(!html.includes('bytes.bin'));
  for(const name of ['Cache-Control','X-Robots-Tag','X-Content-Type-Options','Content-Security-Policy','Referrer-Policy'])assert.ok(response.headers.get(name));
  assert.match(response.headers.get('Content-Security-Policy'),/script-src 'none'/);
  const head=await handler(new Request(origin+'/__dev/outbox',{method:'HEAD',headers:{Host:'127.0.0.1:8787'}}));assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal(await handler(new Request(origin+'/__dev/outbox',{headers:{Host:'evil.example',Forwarded:'host=127.0.0.1:8787'}})),null);
  now+=1000;assert.deepEqual(await outbox.list(),[]);assert.equal(await outbox.get(messages[0].id),null);
  // A subsequent write prunes expired rows as well as enforcing the count bound.
  await outbox.put({...message,deliveryId:'fresh'});assert.equal((await db.DB.prepare('SELECT count(*) n FROM rer_mail_development_outbox').first()).n,1);
 }finally{await db.dispose();}
});
