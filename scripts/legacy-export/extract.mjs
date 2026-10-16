import {identifier,snapshot} from './mysql.mjs';
import {credentialColumns,skippedTables,supportEventTypes} from './scope.mjs';
import {projectQueries} from './queries.mjs';
import {enrichMedia} from './attachments.mjs';
import {classifyColumns,classifyValue} from './secrets.mjs';

export async function extractProject(connection,{projectId,revision,aiModel,mailFromDomain,maxBytes=256*1024*1024,sink,deferMailDomain=false}) {
  if(!projectId||!revision)throw Error('Explicit --project and --revision are required');
  return snapshot(connection,async()=>{
    const [inventory]=await connection.execute("SELECT TABLE_NAME name,ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
    const [columns]=await connection.execute('SELECT TABLE_NAME name,COLUMN_NAME col,DATA_TYPE type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY ORDINAL_POSITION');
    const schema=new Map(inventory.map(t=>[t.name,{engine:t.engine,columns:columns.filter(c=>c.name===t.name)}]));
    for(const [table,info]of schema)if(!skippedTables.includes(table))classifyColumns(table,info.columns);
    const scopes=projectQueries(schema,projectId),tables={},omittedColumns={},rowCounts={},cloneCounts={};let bytes=0;
    for(const [table,{where,args}]of scopes){
      const info=schema.get(table);if(info.engine!=='InnoDB')throw Error(`Consistent snapshot requires InnoDB: ${table}`);
      const selected=classifyColumns(table,info.columns),omit=credentialColumns[table]||[];
      omittedColumns[table]=info.columns.filter(c=>omit.includes(c.col)).map(c=>c.col);
      const [[count]]=await connection.execute(`SELECT COUNT(*) n FROM ${identifier(table)} WHERE ${where}`,args);cloneCounts[table]=Number(count.n);
      const query=connection.connection.query({sql:`SELECT ${selected.map(c=>identifier(c.col)).join(',')} FROM ${identifier(table)} WHERE ${where} ORDER BY ${table==='categories'?'_lft,id':info.columns.some(c=>c.col==='id')?'id':selected.map(c=>identifier(c.col)).join(',')}`,values:args});
      const rows=[];let n=0;
      for await(const input of query.stream({highWaterMark:16})){
        const row={...input};for(const c of selected){const v=row[c.col];
          if(v!==null&&c.type==='json'&&typeof v==='string')row[c.col]=JSON.parse(v);
          else if(v!==null&&/^(timestamp|datetime|date)$/.test(c.type))row[c.col]=String(v).replace(' ','T')+(c.type==='date'?'T00:00:00.000Z':'Z');
          else if(Buffer.isBuffer(v))throw Error(`Binary column needs an explicit encoding: ${table}.${c.col}`);
          classifyValue(table,c.col,row[c.col]);
        }
        if(table==='projects'&&row.slug&&!deferMailDomain&&(!mailFromDomain||!/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z0-9-]+$/i.test(mailFromDomain)))throw Error('Project slug requires explicit --mail-from-domain (legacy MAIL_FROM_DOMAIN)');
        bytes+=Buffer.byteLength(JSON.stringify(row));if(!sink&&bytes>maxBytes)throw Error('Project rows exceed --max-row-bytes; use chunked directory output');
        if(sink)await sink.row(table,row);else rows.push(row);n++;
      }
      if(n!==cloneCounts[table])throw Error(`Snapshot count mismatch: ${table}`);
      rowCounts[table]=n;if(sink)await sink.endTable(table);else tables[table]=rows;
    }
    if(rowCounts.projects!==1)throw Error('Requested project does not exist or is not readable');
    if((rowCounts.ais||rowCounts.ai_defaults)&&!aiModel)throw Error('AI rows require an explicit --ai-model for native use');
    const source={repository:'happytohelp',revision,exportedAt:new Date().toISOString(),projectId,...(aiModel?{aiModel}:{}),...(mailFromDomain?{mailFromDomain:mailFromDomain.toLowerCase()}:{mailboxPending:true}),snapshot:'REPEATABLE READ; CONSISTENT SNAPSHOT; READ ONLY; UTC',omittedColumns,excludedTables:inventory.map(t=>t.name).filter(t=>skippedTables.includes(t)),eventTypes:supportEventTypes,rowCounts,cloneCounts,rowBytes:bytes};
    const bundle={format:'happytohelp-legacy-v1',source,tables};if(!sink)source.attachments=enrichMedia(tables);return bundle;
  });
}
