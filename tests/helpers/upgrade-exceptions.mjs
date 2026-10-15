import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const text = value => ['text', Buffer.from(value).toString('hex')];
const integer = value => ['integer', String(value)];
const records = table => table.rows.map(row => Object.fromEntries(table.columns.map((column, i) => [column, JSON.parse(row)[i]])));
const rows = (table, values) => values.map(value => JSON.stringify(table.columns.map(column => value[column]))).sort();
const key = value => JSON.stringify([value.project_id, value.subject_id]);

// The complete exception list; each applies only when its migration is newly
// applied by the upgrade. 0106 changes only missing project secrets; 0108 inserts
// missing contact subjects with defaults and bumps every revision once. 0.4's ten
// migrations (0110-119) rewrite no pre-existing row. Wrangler appends
// d1_migrations; only its sqlite_sequence row may advance.
export const migrationExceptions = [
  {migration: '0106_project_verification_secret.sql', table: 'projects', columns: ['verification_secret'], rows: 'pre-existing projects whose secret is NULL or empty'},
  {migration: '0108_public_answer_citations.sql', table: 'context_subjects', columns: ['revision'], rows: 'existing subjects: revision + 1; missing contact subjects: exact defaults and revision 1'},
  {migration: 'Wrangler migration ledger', table: 'sqlite_sequence', columns: ['seq'], rows: 'name = d1_migrations only, advances by the number of newly applied migrations'},
];
// Prior schema definitions a migration deliberately replaces. 0110 adds only the
// native import fence to the two context message triggers' bodies.
export const schemaExceptions = [
  {migration: '120_activation_observations.sql', names: ['activation_receipts'], change: 'Adds nullable observation_json TEXT; every prior column definition is retained'},
  {migration: '121_move_in_categories.sql', names: ['edition_category_insert', 'edition_category_delete'], change: 'Removes insertion invalidation and limits deletion invalidation to affected article ancestry'},
  {migration: '0110_move_in.sql', names: ['context_message_added', 'context_message_removed'], change: 'WHEN NOT EXISTS(SELECT 1 FROM move_in_native_fences ...) inserted before BEGIN'},
];

export function expectedMigrationRows(before, after, migrationNames) {
  // Appending the ledger cannot rewrite any previously applied migration row.
  const ledger = records(after.d1_migrations);
  assert.deepEqual(ledger.map(row => row.name).sort(), migrationNames.map(text).sort());
  for (const row of before.d1_migrations.rows) assert.ok(after.d1_migrations.rows.includes(row), 'Existing migration ledger row changed');
  const applied = new Set(records(before.d1_migrations).map(row => Buffer.from(row.name[1], 'hex').toString()));
  const added = migrationNames.filter(name => !applied.has(name));
  assert.equal(after.d1_migrations.rowCount, migrationNames.length);
  const expected = {};

  if (added.includes('0106_project_verification_secret.sql')) {
    const projects = records(before.projects), projectById = new Map(records(after.projects).map(row => [JSON.stringify(row.id), row]));
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
    expected.projects = rows(before.projects, projects);
  }

  if (added.includes('0108_public_answer_citations.sql')) {
    const subjects = records(before.context_subjects), subjectKeys = new Set(subjects.map(key));
    for (const subject of subjects) {
      assert.equal(subject.revision[0], 'integer');
      subject.revision = integer(BigInt(subject.revision[1]) + 1n);
    }
    for (const contact of records(before.contacts)) {
      const subject = {project_id: contact.project_id, subject_id: contact.id, consent: integer(0), revision: integer(1), help_types: text('[]'), bot_enabled: integer(1)};
      if (!subjectKeys.has(key(subject))) { subjects.push(subject); subjectKeys.add(key(subject)); }
    }
    expected.context_subjects = rows(before.context_subjects, subjects);
  }

  const sequence = records(before.sqlite_sequence);
  const migrationSequence = sequence.find(row => JSON.stringify(row.name) === JSON.stringify(text('d1_migrations')));
  assert.ok(migrationSequence, 'Baseline migration sequence missing');
  migrationSequence.seq = integer(BigInt(migrationSequence.seq[1]) + BigInt(added.length));
  expected.sqlite_sequence = rows(before.sqlite_sequence, sequence);

  const used = migrationExceptions.filter(exception => exception.migration === 'Wrangler migration ledger' || added.includes(exception.migration));
  assert.deepEqual(Object.keys(expected).sort(), used.map(exception => exception.table).sort());
  // Full encoded rows still assert every non-excepted column, identity and count.
  for (const [table, expectedRows] of Object.entries(expected)) assert.deepEqual(after[table].rows, expectedRows, `Unexpected transformation in ${table}`);
  return {expected, added, exceptions: used};
}

// Every prior table, index, trigger and view keeps its exact definition, except
// the listed replacements, which must match their documented change exactly.
export function expectedSchema(before, after, added) {
  const changed = [];
  for (const [name, entry] of Object.entries(before)) {
    const fence = added.includes('0110_move_in.sql') && {context_message_added: 'NEW', context_message_removed: 'OLD'}[name];
    let wanted = fence ? {...entry, sql: entry.sql.replace(' BEGIN ', ` WHEN NOT EXISTS(SELECT 1 FROM move_in_native_fences f WHERE f.project_id=${fence}.project_id AND f.conversation_id=${fence}.conversation_id) BEGIN `)} : entry;
    if (added.includes('120_activation_observations.sql') && name === 'activation_receipts') {
      // Let SQLite serialize the one deliberate ALTER; this retains every byte
      // of the prior definition rather than ignoring the changed table schema.
      const db = new DatabaseSync(':memory:');
      try {
        db.exec(entry.sql);
        db.exec('ALTER TABLE activation_receipts ADD COLUMN observation_json TEXT');
        wanted = {...entry, sql: db.prepare("SELECT sql FROM sqlite_master WHERE name='activation_receipts'").get().sql};
      } finally { db.close(); }
    }
    if (added.includes('121_move_in_categories.sql')) {
      if (name === 'edition_category_insert') {
        if (after[name] !== undefined) changed.push(name);
        continue;
      }
      if (name === 'edition_category_delete') wanted = {...entry, sql: categoryDelete};
    }
    if (JSON.stringify(after[name]) !== JSON.stringify(wanted)) changed.push(name);
  }
  return changed;
}

// The deliberate replacement's full expected body: unrelated article revisions
// must not be invalidated, including articles linked through the join table.
const categoryDelete = `CREATE TRIGGER edition_category_delete BEFORE DELETE ON knowledge_categories BEGIN
 UPDATE knowledge_articles SET source_revision=source_revision+1
 WHERE project_id=OLD.project_id AND (
  category_id IN (WITH RECURSIVE descendants(id) AS (SELECT OLD.id UNION SELECT c.id FROM knowledge_categories c JOIN descendants d ON c.parent_id=d.id WHERE c.project_id=OLD.project_id) SELECT id FROM descendants)
  OR id IN (SELECT article_id FROM knowledge_article_categories WHERE category_id IN (WITH RECURSIVE descendants(id) AS (SELECT OLD.id UNION SELECT c.id FROM knowledge_categories c JOIN descendants d ON c.parent_id=d.id WHERE c.project_id=OLD.project_id) SELECT id FROM descendants))
 );
END`;
