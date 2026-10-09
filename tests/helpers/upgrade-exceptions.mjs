import assert from 'node:assert/strict';

const text = value => ['text', Buffer.from(value).toString('hex')];
const integer = value => ['integer', String(value)];
const records = table => table.rows.map(row => Object.fromEntries(table.columns.map((column, i) => [column, JSON.parse(row)[i]])));
const rows = (table, values) => values.map(value => JSON.stringify(table.columns.map(column => value[column]))).sort();
const key = value => JSON.stringify([value.project_id, value.subject_id]);

// The complete exception list. 0106 changes only missing project secrets;
// 0108 inserts missing contact subjects with defaults and bumps every revision once.
// Wrangler appends d1_migrations; only its sqlite_sequence row may advance.
export const migrationExceptions = [
  {migration: '0106_project_verification_secret.sql', table: 'projects', columns: ['verification_secret'], rows: 'pre-existing projects whose secret is NULL or empty'},
  {migration: '0108_public_answer_citations.sql', table: 'context_subjects', columns: ['revision'], rows: 'existing subjects: revision + 1; missing contact subjects: exact defaults and revision 1'},
  {migration: 'Wrangler migration ledger', table: 'sqlite_sequence', columns: ['seq'], rows: 'name = d1_migrations only, advances by the number of newly applied migrations'},
];

export function expectedMigrationRows(before, after, migrationNames) {
  // Appending the ledger cannot rewrite any previously applied migration row.
  const ledger = records(after.d1_migrations);
  assert.deepEqual(ledger.map(row => row.name).sort(), migrationNames.map(text).sort());
  for (const row of before.d1_migrations.rows) assert.ok(after.d1_migrations.rows.includes(row), 'Existing migration ledger row changed');
  const addedMigrations = migrationNames.length - before.d1_migrations.rowCount;
  assert.equal(after.d1_migrations.rowCount, migrationNames.length);

  const projects = records(before.projects), migratedProjects = records(after.projects);
  const projectById = new Map(migratedProjects.map(row => [JSON.stringify(row.id), row]));
  const secrets = new Set();
  for (const project of projects) {
    const migrated = projectById.get(JSON.stringify(project.id));
    assert.ok(migrated, 'Pre-existing project missing');
    assert.equal(migrated.verification_secret?.[0], 'text', 'Project verification secret must be present');
    const secret = Buffer.from(migrated.verification_secret[1], 'hex').toString();
    assert.match(secret, /^[a-f0-9]{64}$/, '0106 secret must be lowercase hex encoding of 32 random bytes');
    assert.ok(!secrets.has(secret), 'Project verification secrets must be unique');
    secrets.add(secret);
    if (JSON.stringify(project.verification_secret) === JSON.stringify(['null']) || JSON.stringify(project.verification_secret) === JSON.stringify(text(''))) {
      project.verification_secret = migrated.verification_secret;
    } else assert.deepEqual(migrated.verification_secret, project.verification_secret, '0106 must preserve an existing secret');
  }

  const subjects = records(before.context_subjects);
  const subjectKeys = new Set(subjects.map(key));
  for (const subject of subjects) {
    assert.equal(subject.revision[0], 'integer');
    subject.revision = integer(BigInt(subject.revision[1]) + 1n);
  }
  for (const contact of records(before.contacts)) {
    const subject = {project_id: contact.project_id, subject_id: contact.id, consent: integer(0), revision: integer(1), help_types: text('[]'), bot_enabled: integer(1)};
    if (!subjectKeys.has(key(subject))) { subjects.push(subject); subjectKeys.add(key(subject)); }
  }

  const sequence = records(before.sqlite_sequence);
  const migrationSequence = sequence.find(row => JSON.stringify(row.name) === JSON.stringify(text('d1_migrations')));
  assert.ok(migrationSequence, 'Baseline migration sequence missing');
  migrationSequence.seq = integer(BigInt(migrationSequence.seq[1]) + BigInt(addedMigrations));

  const expected = {projects: rows(before.projects, projects), context_subjects: rows(before.context_subjects, subjects), sqlite_sequence: rows(before.sqlite_sequence, sequence)};
  assert.deepEqual(Object.keys(expected).sort(), migrationExceptions.map(exception => exception.table).sort());
  // Full encoded rows still assert every non-excepted column, identity and count.
  for (const [table, expectedRows] of Object.entries(expected)) assert.deepEqual(after[table].rows, expectedRows, `Unexpected transformation in ${table}`);
  return expected;
}
