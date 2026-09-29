#!/usr/bin/env python3
"""Produce a credential-free D1 export, also mandatory before restoring any backup.
Reads a stopped D1 SQL export; emits ordinary SQLite SQL, preserving schema/history.
No application or remote database is touched. Uses the Python standard library.
"""
import argparse
import sqlite3
from pathlib import Path

CREDENTIAL_TABLES = ('edition_codes', 'edition_consents', 'edition_grants', 'edition_effect_guards')

def sanitize(sql):
    db = sqlite3.connect(':memory:')
    try:
        db.executescript(sql)
        db.execute('PRAGMA foreign_keys=OFF')
        tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        for table in CREDENTIAL_TABLES:
            if table in tables:
                db.execute(f'DELETE FROM "{table}"')
        db.commit()
        return '\n'.join(db.iterdump()) + '\n'
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
