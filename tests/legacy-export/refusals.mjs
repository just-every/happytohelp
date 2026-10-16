import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {join} from 'node:path';

async function noPublication(output,file,before) {
  await assert.rejects(access(file),{code:'ENOENT'},'refused export publishes no artifact');
  assert.deepEqual((await readdir(output)).sort(),before,'refused export leaves no partial artifact');
}

export async function assertCredentialRefusals({admin,run,env,output,projectId,snapshotArgs,snapshot,objectDirectory}) {
  let index=0;
  const refuse=async()=>{
    const file=join(output,`refused-${++index}.json`),before=(await readdir(output)).sort();
    await assert.rejects(run('scripts/export-legacy.mjs',[...snapshotArgs,'--output',file],env),/Unclassified secret-like legacy field/);
    await noPublication(output,file,before);
  };
  await admin.query('ALTER TABLE contacts ADD unexpected_secret TEXT NULL');
  try {
    await admin.execute('UPDATE contacts SET unexpected_secret=? WHERE project_id=?',['fixture-unexpected-secret',projectId]);
    await refuse();
  } finally {await admin.query('ALTER TABLE contacts DROP COLUMN unexpected_secret');}

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
  const signatures=[
    'A pasted credential: ghp_test_'+'x'.repeat(36),
    'Authorization: Bearer fixtureOpaqueCredential123456',
    'A pasted key:\n-----BEGIN PRIVATE KEY-----\nfixture-private-key\n-----END PRIVATE KEY-----',
    'Session '+[JSON.stringify({alg:'HS256'}),JSON.stringify({sub:'fixture'}),'fixture-signature'].map(value=>Buffer.from(value).toString('base64url')).join('.'),
    'api_token=fixture-hidden-text-token',
    'Digest-looking credential: '+'a1'.repeat(32),
    'Encoded payload: '+Buffer.from(JSON.stringify({iv:'fixture-iv',value:'fixture-ciphertext',mac:'fixture-mac'})).toString('base64'),
  ];
  try {
    for (const content of signatures) {
      await admin.execute('UPDATE messages SET content=? WHERE id=?',[content,message.id]);
      await refuse();
    }
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
