import {identifier, snapshot} from './mysql.mjs';
import {directTables, credentialColumns, skippedTables, morphTables, childScopes} from './scope.mjs';
import {enrichMedia} from './attachments.mjs';

export async function extractProject(connection, {projectId, revision, aiModel, maxBytes = 256 * 1024 * 1024}) {
  if (!projectId || !revision) throw Error('Explicit --project and --revision are required');
  return snapshot(connection, async () => {
    const [inventory] = await connection.execute(`SELECT TABLE_NAME name, ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'`);
    const [columns] = await connection.execute('SELECT TABLE_NAME name,COLUMN_NAME col,DATA_TYPE type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY ORDINAL_POSITION');
    const schema = new Map(inventory.map(t => [t.name, {engine:t.engine, columns:columns.filter(c=>c.name===t.name)}]));
    const tables = {}, omittedColumns = {}, included = new Set(); let bytes = 0;
    const read = async (table, predicate, params = []) => {
      const info = schema.get(table); if (!info) return [];
      if (info.engine !== 'InnoDB') throw Error(`Consistent snapshot requires InnoDB: ${table}`);
      const omit = credentialColumns[table] || [];
      omittedColumns[table] = info.columns.filter(c=>omit.includes(c.col)).map(c=>c.col);
      const selected = info.columns.filter(c=>!omit.includes(c.col));
      const fields = selected.map(c=>identifier(c.col)).join(',');
      // Stream the source query so a too-large project fails before filling memory.
      const query = connection.connection.query({sql:`SELECT ${fields} FROM ${identifier(table)} WHERE ${predicate}`, values:params});
      const rows = [];
      for await (const input of query.stream({highWaterMark:16})) {
        const row = {...input};
        for (const c of selected) {
          const value = row[c.col];
          if (value !== null && c.type === 'json' && typeof value === 'string') row[c.col] = JSON.parse(value);
          else if (value !== null && /^(timestamp|datetime|date)$/.test(c.type)) row[c.col] = String(value).replace(' ','T') + (c.type === 'date' ? 'T00:00:00.000Z' : 'Z');
          else if (Buffer.isBuffer(value)) throw Error(`Binary column needs an explicit encoding: ${table}.${c.col}`);
        }
        bytes += Buffer.byteLength(JSON.stringify(row));
        if (bytes > maxBytes) throw Error('Project rows exceed --max-row-bytes; use a larger explicit limit');
        rows.push(row);
      }
      rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      tables[table] = rows; included.add(table); return rows;
    };
    const selected = await read('projects','id=?',[projectId]);
    if (selected.length !== 1) throw Error('Requested project does not exist or is not readable');
    for (const table of directTables.filter(t=>t!=='projects')) await read(table,'project_id=?',[projectId]);
    const through = (parent, field = 'id') => `SELECT ${identifier(field)} FROM ${identifier(parent)} WHERE project_id=?`;
    for (const [table,[foreign,parent]] of Object.entries(childScopes))
      if (schema.has(parent)) await read(table,`${identifier(foreign)} IN (${through(parent)})`,[projectId]);
    if (schema.has('articles') && schema.has('categories'))
      await read('article_categories',`article_id IN (${through('articles')}) AND category_id IN (${through('categories')})`,[projectId,projectId]);
    const authorFields = new Set(['user_id','agent_id','invited_by_id','created_by_id','modified_by_id']);
    const authors = new Set((tables.ais || []).map(row=>String(row.id)));
    for (const rows of Object.values(tables)) for (const row of rows)
      for (const [key,value] of Object.entries(row)) if (authorFields.has(key) && value) authors.add(String(value));
    if (authors.size) await read('users',`id IN (${[...authors].map(()=>'?').join(',')})`,[...authors]);
    else if(schema.has('users')) {tables.users=[]; included.add('users');}
    const types = [...new Set((tables.ais || []).map(row=>row.type))];
    if (types.length) await read('ai_defaults',`type IN (${types.map(()=>'?').join(',')})`,types);
    const morphs = Object.entries(morphTables).filter(([,table])=>tables[table]?.length);
    if (schema.has('mediables') && morphs.length) {
      const predicates=[], params=[];
      for (const [name,table] of morphs) {
        const ids=tables[table].map(r=>r.id);
        predicates.push(`(mediable_type=? AND mediable_id IN (${ids.map(()=>'?').join(',')}))`);
        params.push(`App\\Models\\${name}`,...ids);
      }
      await read('mediables',predicates.join(' OR '),params);
      const mediaIds=[...new Set(tables.mediables.map(row=>row.media_id))];
      if (mediaIds.length) {
        await read('media',`id IN (${mediaIds.map(()=>'?').join(',')}) OR original_media_id IN (${mediaIds.map(()=>'?').join(',')})`,[...mediaIds,...mediaIds]);
      }
    }
    if ((tables.ais?.length || tables.ai_defaults?.length) && !aiModel) throw Error('AI rows require an explicit --ai-model for native use');
    const unknownTables = inventory.map(t=>t.name).filter(t=>!included.has(t)&&!skippedTables.includes(t)&&!directTables.includes(t)&&!Object.hasOwn(childScopes,t)&&!['ai_defaults','media','mediables','users','article_categories'].includes(t));
    if (unknownTables.length) throw Error(`Unclassified legacy tables; add an explicit scope or drop decision: ${unknownTables.join(', ')}`);
    const bundle = {format:'happytohelp-legacy-v1',source:{repository:'happytohelp',revision,exportedAt:new Date().toISOString(),projectId,
      ...(aiModel?{aiModel}:{}),snapshot:'REPEATABLE READ; CONSISTENT SNAPSHOT; READ ONLY; UTC',omittedColumns,
      excludedTables:inventory.map(t=>t.name).filter(t=>skippedTables.includes(t)),rowCounts:Object.fromEntries(Object.entries(tables).map(([t,r])=>[t,r.length]))},tables};
    bundle.source.attachments = enrichMedia(tables);
    return bundle;
  });
}
