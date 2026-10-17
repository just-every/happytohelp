import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {join} from 'node:path';

async function noPublication(output,file,before) {
  await assert.rejects(access(file),{code:'ENOENT'},'refused export publishes no artifact');
  assert.deepEqual((await readdir(output)).sort(),before,'refused export leaves no partial artifact');
}

export async function assertCredentialRefusals({admin,run,env,output,projectId,snapshotArgs,snapshot,objectDirectory}) {
  let index=0;
  const refuse=async(expected=/Unclassified secret-like legacy field/)=>{
    const file=join(output,`refused-${++index}.json`),before=(await readdir(output)).sort();
    await assert.rejects(run('scripts/export-legacy.mjs',[...snapshotArgs,'--output',file],env),expected);
    await noPublication(output,file,before);
  };
  await admin.query('ALTER TABLE contacts ADD unexpected_secret TEXT NULL');
  try {
    await admin.execute('UPDATE contacts SET unexpected_secret=? WHERE project_id=?',['fixture-unexpected-secret',projectId]);
    await refuse();
  } finally {await admin.query('ALTER TABLE contacts DROP COLUMN unexpected_secret');}

  await admin.execute('UPDATE mediables SET mediable_type=? WHERE mediable_type=?',['App\\Models\\Unclassified','App\\Models\\Message']);
  try {await refuse(/Unclassified legacy media parent/);}
  finally {await admin.execute('UPDATE mediables SET mediable_type=? WHERE mediable_type=?',['App\\Models\\Message','App\\Models\\Unclassified']);}

  const [[contact]]=await admin.execute('SELECT id,metadata FROM contacts WHERE project_id=? ORDER BY id LIMIT 1',[projectId]);
  const original=typeof contact.metadata==='string'?contact.metadata:JSON.stringify(contact.metadata);
  // Innocent SQL column names do not grant blanket permission to nested JSON.
  const jsonCases=[
    {activity:{access_token:'fixture-hidden-json-token'}},
    {activity:JSON.stringify({private_key:'fixture-hidden-text-key'})},
    {activity:{password:'fixture-hidden-json-password'}},
    {activity:{iv:'fixture-iv',value:'fixture-ciphertext',mac:'fixture-mac'}},
  ];
  try {
    for (const metadata of jsonCases) {
      await admin.execute('UPDATE contacts SET metadata=? WHERE id=?',[JSON.stringify(metadata),contact.id]);
      await refuse();
    }
  } finally {await admin.execute('UPDATE contacts SET metadata=? WHERE id=?',[original,contact.id]);}

  const [[message]]=await admin.execute('SELECT id,content FROM messages WHERE project_id=? ORDER BY id LIMIT 1',[projectId]);
  const jwt=[JSON.stringify({alg:'HS256'}),JSON.stringify({sub:'fixture'}),'fixture-signature'].map(value=>Buffer.from(value).toString('base64url')).join('.');
  const customerKey='sk_'+'Fixture0'.repeat(4),opaque=Buffer.from('fixture-opaque-credential-value').toString('base64').slice(0,32);
  const signatures=[
    ['A pasted credential: ghp_test_'+'x'.repeat(36),'ghp_test_'+'x'.repeat(36)],
    ['Authorization: Bearer fixtureOpaqueCredential123456','fixtureOpaqueCredential123456'],
    ['A pasted key:\n-----BEGIN PRIVATE KEY-----\nfixture-private-key\n-----END PRIVATE KEY-----','fixture-private-key'],
    ['Session '+jwt,jwt],
    ['api_token=fixture-hidden-text-token','fixture-hidden-text-token'],
    ['Digest-looking credential: '+'a1'.repeat(32),'a1'.repeat(32)],
    ['Cookie: support_session=fixture-short-cookie','fixture-short-cookie'],
    ['<input type="hidden" name="_s" value="fixture-short-csrf">','fixture-short-csrf'],
    [JSON.stringify({request:{headers:[{name:'Cookie',value:'session=fixture-har-cookie'}]}}),'fixture-har-cookie'],
    // Prefix-typed keys without live_/test_, curl Basic, empty-user DSNs, split and grouped values, pwd links, opaque runs, repeats.
    ['I refreshed the API private key to be '+customerKey,customerKey],
    ['curl https://api.example.test/v1/charges -u '+customerKey+':',customerKey],
    ['curl -u fixture-user:fixture-curl-password https://api.example.test','fixture-curl-password'],
    ['REDIS_URL is redis://:fixture-redis-password@cache.example.test:6379','fixture-redis-password'],
    ['Login password: fixture;split-remnant','split-remnant'],
    ['Manual key: FIXT URES ETUP KEY2 in the app','ETUP KEY2'],
    ['Join https://meet.example.test/j/1?pwd=fixture-meeting-passcode','fixture-meeting-passcode'],
    ['Here it is '+opaque+' thanks',opaque],
    ['secret_key: fixture.'+customerKey.slice(3)+'.tail and later '+customerKey.slice(3),customerKey.slice(3)],
    // Provider prefixes and hosts, HAR fragments, curl cookies, uppercase keys, prose labels and wrapped values.
    ['Our bot uses '+'xox'+'b-'+'1'.repeat(12)+'-'+'2'.repeat(13)+'-Fixture0Slack0Bot0Token0','Fixture0Slack0Bot0Token0'],
    ['Post to https://hooks.slack.com/services/'+'T0FIXTURE'+'/B0FIXTURE0/'+'Fixture0Webhook0Secret00 please','Fixture0Webhook0Secret00'],
    ['Shopify '+'shp'+'at_'+'f1'.repeat(16)+' ok','f1'.repeat(16)],
    ['GitLab '+'gl'+'pat-'+'Fixture0GitLab0Token0 ok','Fixture0GitLab0Token0'],
    ['HubSpot '+'pat-'+'na1-'+'0f1a7b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c ok','0f1a7b2c-3d4e-4f5a-8b6c-7d8e9f0a1b2c'],
    ['application password: Fx01 Ab2c Cd3e Ef4g Gh5i Ij6k for the plugin','Cd3e Ef4g'],
    ['... "headers": [{"name": "Cookie", "value": "sessionid=fixture-har-fragment-cookie"}, {"name": "Accept"','fixture-har-fragment-cookie'],
    ["curl -b 'sessionid=fixture-curl-cookie' https://api.example.test",'fixture-curl-cookie'],
    ['curl https://api.example.test -u '+'FIXTURE0UPPERCASE0KEY0123'+':','FIXTURE0UPPERCASE0KEY0123'],
    ['key '+'sk_'+'live_'+'Wrapped0Fixture0Key0\nTail0Wrap99 ok','Tail0Wrap99'],
    ['password: Fx0Wrap1\nFx0Tail2 ok','Fx0Tail2'],
    ['my password is Fixture0Prose! please help','Fixture0Prose'],
    ['user: bob@example.test pass: Fixture0Pass thanks','Fixture0Pass'],
    ['Benutzer: admin Passwort: Fixture0Passwort danke','Fixture0Passwort'],
  ];
  try {
    // These signatures now have an explicit OMIT classification for support
    // text. Prove the credential itself is absent; unknown content still refuses.
    for (const [content,actual] of signatures) {
      await admin.execute('UPDATE messages SET content=? WHERE id=?',[content,message.id]);
      const file=join(output,`omitted-text-${++index}.json`);
      await run('scripts/export-legacy.mjs',[...snapshotArgs,'--output',file],env);
      const bundle=JSON.parse(await readFile(file,'utf8'));
      assert.ok(bundle.source.omittedTextValueCounts['messages.content']>0,'classified credential value omitted');
      assert.equal(JSON.stringify(bundle).includes(actual),false,'omitted credential is absent from every source table');
    }
    for(const content of [
      'new_provider_secret=fixture-unclassified-secret',
      'Encoded payload: '+Buffer.from(JSON.stringify({iv:'fixture-iv',value:'fixture-ciphertext',mac:'fixture-mac'})).toString('base64'),
    ]){await admin.execute('UPDATE messages SET content=? WHERE id=?',[content,message.id]);await refuse();}
  } finally {await admin.execute('UPDATE messages SET content=? WHERE id=?',[message.content,message.id]);}

  // An old or edited snapshot cannot bypass extraction's column classification.
  for (const [table,column] of [['connections','contact_shared_key'],['collector_actions','action']]) {
    const bundle=JSON.parse(await readFile(snapshot,'utf8'));
    bundle.tables[table][0][column]='fixture-reintroduced-credential';
    const input=join(output,`unsafe-input-${++index}.json`),file=join(output,`refused-${index}.json`);
    await writeFile(input,JSON.stringify(bundle));
    const before=(await readdir(output)).sort();
    await assert.rejects(run('scripts/export-legacy.mjs',['attachments','--input',input,'--objects-dir',objectDirectory,'--output',file]),/Unclassified secret-like legacy field/);
    await noPublication(output,file,before);
  }
}
