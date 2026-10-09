import importlib.util
import sqlite3
from pathlib import Path
spec = importlib.util.spec_from_file_location('backup', Path(__file__).resolve().parents[1] / 'scripts/independent/delegation-backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
source = '''CREATE TABLE domain(id TEXT PRIMARY KEY, content TEXT); INSERT INTO domain VALUES('kept','exact history');
CREATE TABLE edition_grants(id TEXT, token_hash TEXT); INSERT INTO edition_grants VALUES('g','private hash');
CREATE TABLE edition_codes(code_hash TEXT); INSERT INTO edition_codes VALUES('private code');
CREATE TABLE edition_consents(id TEXT); INSERT INTO edition_consents VALUES('private consent');
CREATE TABLE edition_receipts(id TEXT,request_hash TEXT); INSERT INTO edition_receipts VALUES('receipt','audit hash');'''
clean = backup.sanitize(source)
assert 'private hash' not in clean and 'private code' not in clean and 'private consent' not in clean
restored = sqlite3.connect(':memory:')
restored.executescript(clean)
assert restored.execute('SELECT * FROM domain').fetchall() == [('kept','exact history')]
assert restored.execute('SELECT * FROM edition_receipts').fetchall() == [('receipt','audit hash')]
assert restored.execute('SELECT count(*) FROM edition_grants').fetchone()[0] == 0
restored.close()
print('Delegation export/restore removes credentials and preserves source records and receipts')
