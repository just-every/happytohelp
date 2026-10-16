#!/usr/bin/env python3
"""Produce a credential-free D1 export, also mandatory before restoring any backup.
Reads a stopped D1 SQL export; emits ordinary SQLite SQL, preserving schema/history.
No application or remote database is touched. Uses the Python standard library.
"""
import argparse
import re
import sqlite3
from pathlib import Path

CREDENTIAL_TABLES = ('edition_codes', 'edition_consents', 'edition_grants', 'edition_effect_guards')

def search_definition(db):
    row = db.execute("SELECT type,sql FROM sqlite_master WHERE name='inbox_message_search'").fetchone()
    if row is None:
        return None
    kind, sql = row
    if (kind != 'table' or not isinstance(sql, str)
            or not re.match(r'CREATE\s+VIRTUAL\s+TABLE\s', sql, re.I)
            or not re.search(r'\bUSING\s+fts5\s*\(', sql, re.I)
            or not re.search(r'''\bcontent\s*=\s*(['"])messages\1''', sql, re.I)):
        raise ValueError('Refusing to replace an unrecognized inbox_message_search schema.')
    return sql + ('' if sql.rstrip().endswith(';') else ';')

def sanitize(sql):
    db = sqlite3.connect(':memory:')
    try:
        db.executescript(sql)
        db.execute('PRAGMA foreign_keys=OFF')
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table in CREDENTIAL_TABLES:
            if table in tables:
                db.execute(f'DELETE FROM "{table}"')
        search = search_definition(db)
        if search:
            # iterdump represents virtual tables with writable_schema and raw
            # shadow rows. Recreate this derived cache from messages instead.
            db.execute('DROP TABLE "inbox_message_search"')
        db.commit()
        # D1 cannot disable foreign keys or insert before a referenced table
        # exists. Create the schema first, then defer row checks during import.
        # Its importer owns the transaction, so omit SQLite dump wrappers.
        statements = [line for line in db.iterdump() if line not in ('BEGIN TRANSACTION;', 'COMMIT;')]
        schema, data = [], []
        for statement in statements:
            target = schema if re.match(r'CREATE\s+(?:TABLE|(?:UNIQUE\s+)?INDEX)\s', statement, re.I) else data
            target.append(statement)
        dump = 'PRAGMA defer_foreign_keys=ON;\n' + '\n'.join(schema + data) + '\n'
        if search:
            dump += search + '\nINSERT INTO "inbox_message_search"("inbox_message_search") VALUES(\'rebuild\');\n'
        return dump + 'PRAGMA defer_foreign_keys=OFF;\n'
    finally:
        db.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error('Use a separate output; retain your original backup privately.')
    with args.output.open('x') as output:
        output.write(sanitize(args.input.read_text()))
