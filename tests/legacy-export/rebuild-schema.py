"""Rebuild fixture DDL offline from the legacy Laravel migrations, without booting it.

Usage: python3 tests/legacy-export/rebuild-schema.py /path/to/database/migrations
Only schema declarations are interpreted; data backfills are deliberately excluded.
Unknown Blueprint operations fail closed. No database, environment or network is read.
"""
import ast
import re
import sys
from pathlib import Path


def args(source):
    source = source.replace('User::TYPE_REGULAR', "'regular'")
    source = re.sub(r"'[^']*'|\"[^\"]*\"|\b(?:true|false|null)\b",
                    lambda match: {'true':'True','false':'False','null':'None'}.get(match[0],match[0]), source)
    return list(ast.literal_eval('[' + source + ']'))


def quote(value):
    return '`' + value + '`'


def columns(value):
    return ', '.join(map(quote, value if isinstance(value, list) else [value]))


def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, bool)):
        return str(int(value))
    return "'" + str(value).replace("'", "''") + "'"


tables = {}


def index(table, kind, names, name=None):
    names = names if isinstance(names, list) else [names]
    name = name or table['name'] + '_' + '_'.join(names) + '_' + kind
    table['indexes'][name] = (kind, names)


def blueprint(table, body):
    for statement in body.split(';'):
        if not statement.strip():
            continue
        chain = re.findall(r'(?:\$table->|->)(\w+)\((.*?)\)', statement, re.S)
        if not chain:
            raise ValueError('Unrecognised schema statement: ' + statement)
        method, raw = chain.pop(0)
        values = args(raw)
        if method == 'timestamps':
            blueprint(table, "$table->timestamp('created_at')->nullable();$table->timestamp('updated_at')->nullable();")
            continue
        if method in ('softDeletes', 'rememberToken'):
            blueprint(table, "$table->" + ('timestamp' if method == 'softDeletes' else 'string') + "('" + ('deleted_at' if method == 'softDeletes' else 'remember_token') + "'" + (',100' if method == 'rememberToken' else '') + ')->nullable();')
            continue
        if method == 'dropColumn':
            removed = values[0]
            del table['columns'][removed]
            table['indexes'] = {key:(kind,remaining) for key,(kind,names) in table['indexes'].items()
                                if (remaining := [name for name in names if name != removed])}
            continue
        if method == 'renameColumn':
            old, new = values
            table['columns'] = {new if k == old else k: v for k, v in table['columns'].items()}
            for name, (kind, names) in table['indexes'].items():
                table['indexes'][name] = (kind, [new if n == old else n for n in names])
            for fk in table['foreign'].values():
                fk['column'] = new if fk['column'] == old else fk['column']
            continue
        if method.startswith('drop'):
            kind = {'dropUnique': 'unique', 'dropIndex': 'index', 'dropForeign': 'foreign'}[method]
            name = values[0] if isinstance(values[0], str) else table['name'] + '_' + '_'.join(values[0]) + '_' + kind
            del table['foreign' if kind == 'foreign' else 'indexes'][name]
            continue
        if method in ('primary', 'index', 'unique'):
            index(table, method, *values)
            continue
        fk = None
        if method == 'foreign':
            name = values[1] if len(values) > 1 else table['name'] + '_' + values[0] + '_foreign'
            fk = table['foreign'][name] = {'column': values[0]}
            column = None
        else:
            name = values[0] if values else 'id'
            types = {'uuid': 'char(36)', 'foreignUuid': 'char(36)', 'string': 'varchar(%s)' % (values[1] if len(values) > 1 else 255),
                     'char': 'char(%s)' % (values[1] if len(values) > 1 else 255), 'text': 'text', 'longText': 'longtext',
                     'mediumText': 'mediumtext', 'json': 'json', 'boolean': 'tinyint(1)', 'integer': 'int',
                     'bigInteger': 'bigint', 'smallInteger': 'smallint', 'tinyInteger': 'tinyint',
                     'unsignedBigInteger': 'bigint unsigned', 'unsignedInteger': 'int unsigned', 'unsignedTinyInteger': 'tinyint unsigned',
                     'bigIncrements': 'bigint unsigned', 'id': 'bigint unsigned',
                     'decimal': 'decimal(%s,%s)' % (values[1] if len(values) > 1 else 8, values[2] if len(values) > 2 else 2)}
            if method in ('timestamp', 'dateTime'):
                datatype = method.lower() + ('(%s)' % values[1] if len(values) > 1 else '')
            else:
                datatype = types[method]
            column = {'type': datatype, 'nullable': False}
            table['columns'][name] = column
            if method in ('id', 'bigIncrements'):
                column['auto'] = True
                index(table, 'primary', name)
        for operation, raw in chain:
            values = args(raw)
            if operation == 'nullable':
                column['nullable'] = values[0] if values else True
            elif operation == 'default':
                column['default'] = literal(values[0])
            elif operation == 'useCurrent':
                column['default'] = 'CURRENT_TIMESTAMP' + (re.search(r'\(\d+\)', column['type']).group() if '(' in column['type'] else '')
            elif operation == 'unsigned':
                if 'unsigned' not in column['type']:
                    column['type'] += ' unsigned'
            elif operation in ('index', 'unique', 'primary'):
                index(table, operation, name, *values)
            elif operation == 'constrained':
                fk = table['foreign'][table['name'] + '_' + name + '_foreign'] = {'column': name, 'references': 'id', 'on': values[0] if values else name.removesuffix('_id') + 's'}
            elif operation in ('references', 'on', 'onDelete', 'onUpdate'):
                fk[operation] = values[0]
            elif operation in ('cascadeOnDelete', 'cascadeOnUpdate', 'nullOnDelete'):
                fk['onUpdate' if operation.endswith('Update') else 'onDelete'] = 'set null' if operation == 'nullOnDelete' else 'cascade'
            elif operation in ('after', 'comment', 'change'):
                pass  # Column order/comments do not change schema validation or export semantics.
            else:
                raise ValueError('Unsupported Blueprint operation: ' + operation)


paths = sorted(Path(sys.argv[1]).glob('*.php'))
for path in paths:
    source = path.read_text()
    source = source[source.index('function up('):]
    source = source[:source.index('function down(')] if 'function down(' in source else source
    source = re.sub(r'/\*.*?\*/|//[^\n]*', '', source, flags=re.S)
    # Process declarations and raw DDL in source order, including table recreation.
    pattern = r"(?:Schema::|\$this->schema->)(create|table)\(\s*'([^']+)'\s*,\s*function\s*\([^)]*\)\s*\{(.*?)\}\s*\);|Schema::dropIfExists\('([^']+)'\);|DB::statement\((['\"])(.*?)\5\);"
    for match in re.finditer(pattern, source, re.S):
        action, name, body, drop, _, sql = match.groups()
        if drop:
            tables.pop(drop, None)
        elif action:
            # The media migration's conditional variant drops only run when columns already exist.
            if path.name == '2020_10_12_000000_add_variants_to_media.php' and 'dropColumn' in body:
                continue
            if action == 'create':
                tables[name] = {'name': name, 'columns': {}, 'indexes': {}, 'foreign': {}}
            blueprint(tables[name], body)
        elif sql.startswith('ALTER TABLE'):
            if '{$tableName}' in sql:
                names = ['connections', 'conversations', 'messages']
            else:
                names = [re.match(r'ALTER TABLE `?(\w+)', sql)[1]]
            for name in names:
                table = tables[name]
                if 'CHANGE' in sql:
                    for col, definition in re.findall(r'CHANGE `([^`]+)` `[^`]+` (.*?)(?=, CHANGE|;|$)', sql):
                        table['columns'][col] = {'raw': definition}
                elif 'FULLTEXT' in sql:
                    found = re.search(r'FULLTEXT(?: INDEX)? (\w+) \(([^)]+)\)', sql)
                    if not found:
                        found = re.search(r'FULLTEXT (\w+)\(([^)]+)\)', sql)
                    index(table, 'fulltext', [c.strip() for c in found[2].split(',')], found[1])
                elif 'ADD UNIQUE' in sql:
                    index(table, 'unique', ['contact_id', 'agent_id'], 'contact_id_agent_id')
                else:
                    raise ValueError('Unsupported raw DDL: ' + sql)

# Laravel's migration repository is framework-created, outside the 138 app migrations.
tables['migrations'] = {'name': 'migrations', 'columns': {'id': {'raw': 'int unsigned NOT NULL AUTO_INCREMENT'}, 'migration': {'raw': 'varchar(255) NOT NULL'}, 'batch': {'raw': 'int NOT NULL'}}, 'indexes': {'PRIMARY': ('primary', ['id'])}, 'foreign': {}}
output = ['-- Generated by rebuild-schema.py from all %d legacy application migrations.' % len(paths),
          '-- Includes Laravel migration repository. No application bootstrap or data backfills.',
          '-- Column display order is normalized; types, defaults, indexes and foreign keys are retained.',
          'SET FOREIGN_KEY_CHECKS=0;']
for name, table in tables.items():
    definitions = []
    for name, column in table['columns'].items():
        sql = column.get('raw')
        if sql is None:
            sql = column['type'] + (' NULL' if column['nullable'] else ' NOT NULL')
            if 'default' in column:
                sql += ' DEFAULT ' + column['default']
            if column.get('auto'):
                sql += ' AUTO_INCREMENT'
        definitions.append(quote(name) + ' ' + sql)
    for name, (kind, names) in table['indexes'].items():
        definitions.append(('PRIMARY KEY' if kind == 'primary' else ('UNIQUE KEY' if kind == 'unique' else 'FULLTEXT KEY' if kind == 'fulltext' else 'KEY') + ' ' + quote(name)) + ' (' + columns(names) + ')')
    for name, fk in table['foreign'].items():
        sql = 'CONSTRAINT ' + quote(name) + ' FOREIGN KEY (' + columns(fk['column']) + ') REFERENCES ' + quote(fk['on']) + ' (' + columns(fk['references']) + ')'
        for key in ('onDelete', 'onUpdate'):
            if key in fk:
                sql += (' ON DELETE ' if key == 'onDelete' else ' ON UPDATE ') + fk[key].upper()
        definitions.append(sql)
    output.append('CREATE TABLE ' + quote(table['name']) + ' (\n  ' + ',\n  '.join(definitions) + '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;')
output.append('SET FOREIGN_KEY_CHECKS=1;')
Path(__file__).with_name('schema.sql').write_text('\n\n'.join(output) + '\n')
print('Rebuilt %d tables from %d migrations' % (len(tables), len(paths)))
