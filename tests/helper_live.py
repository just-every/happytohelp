"""Opt-in real local API/D1 acceptance. Creates its own records; never sends mail.

python3 tests/helper_live.py --server http://localhost:PORT --credentials /private/operator.json
Credential JSON: {"email": "...", "password": "..."}; existing local owner required.
"""
import argparse
import hashlib
from http.cookiejar import CookieJar
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.request import build_opener, HTTPCookieProcessor, Request
from urllib.parse import urlsplit
import uuid

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'agent.py'
sys.path.insert(0, str(SCRIPT.parent))
from agent_state import private_json
from agent_transport import origin


def main(args):
    server = origin(args.server)
    if urlsplit(server).hostname not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('This acceptance runner is restricted to the local test deployment.')
    client = build_opener(HTTPCookieProcessor(CookieJar()))

    def api(path, body=None, method='POST'):
        data = None if body is None else json.dumps(body).encode()
        with client.open(Request(server + '/api' + path, data=data, method=method, headers={'Content-Type': 'application/json', 'Origin': server}), timeout=30) as response:
            return json.load(response)

    api('/auth/signin', private_json(args.credentials))
    root = Path(tempfile.mkdtemp(prefix='h2h-helper-live-'))
    root.chmod(0o700)
    workspace = root / 'workspace'
    workspace.mkdir()
    evidence = workspace / 'acceptance.txt'
    evidence.write_text('Real local helper acceptance evidence.\n')
    tag = str(uuid.uuid4())
    ws = api('/workspaces', {'name': 'Helper acceptance ' + tag, 'path': str(workspace)})['workspace']
    connection = api('/agents', {'name': 'Helper acceptance ' + tag, 'workspaceIds': [ws['id']]})
    token = root / 'token.json'
    token.write_text(json.dumps({'token': connection['token']}))
    token.chmod(0o600)

    def helper(*argv, success=True):
        result = subprocess.run([sys.executable, str(SCRIPT), '--state', str(root / 'state.json'), *argv], text=True, capture_output=True)
        if connection['token'] in result.stdout + result.stderr:
            raise AssertionError('Credential leaked in helper output')
        if (result.returncode == 0) != success:
            raise AssertionError('Helper command failed: ' + argv[0])
        return json.loads(result.stdout if success else result.stderr)

    try:
        helper('connect', '--server', server, '--session', tag, '--token-file', str(token), '--workspace', str(workspace))
        req = api('/requests', {'workspaceId': ws['id'], 'subject': 'Inspect local evidence', 'customerEmail': 'helper-acceptance@example.invalid', 'body': 'Read acceptance.txt and report its hash; do not modify files.'})['request']
        delegated = api('/requests/' + req['id'] + '/delegate', {'mode': 'investigate', 'instructions': 'Read the named local evidence file and report a verified SHA-256. Do not change files or send messages.', 'agentId': connection['agent']['id']})['job']
        claim = helper('claim')
        job = claim['job']['id']
        assert job == delegated['id']
        resumed = helper('claim')
        assert resumed['job']['id'] == job and resumed['runId'] == claim['runId']
        helper('context', '--job', job)
        assert helper('check', '--job', job)['cancelled'] is False
        helper('heartbeat', '--job', job)
        helper('progress', '--job', job, '--message', 'Located the real evidence file.')
        helper('needs_input', '--job', job, '--question', 'Confirm SHA-256 is the requested evidence format?')
        api('/jobs/' + job + '/input', {'message': 'Confirmed: report SHA-256.'})
        assert helper('check', '--job', job)['status'] == 'running'
        helper('context', '--job', job)
        digest = hashlib.sha256(evidence.read_bytes()).hexdigest()
        result = root / 'result.json'
        result.write_text(json.dumps({'status': 'completed', 'result': {'summary': 'Read the local evidence file and verified its SHA-256.', 'verified': True, 'actions': [{'description': 'Read acceptance.txt without modification', 'evidence': 'SHA-256 ' + digest}], 'replies': [], 'follow_up_actions': []}}))
        result.chmod(0o600)
        helper('result', '--job', job, '--file', str(result))
        detail = api('/requests/' + req['id'], method='GET')
        assert any(j['id'] == job and j['status'] == 'completed' for j in detail['jobs'])
        assert evidence.read_text() == 'Real local helper acceptance evidence.\n'
        receipt = {'server': server, 'workspaceId': ws['id'], 'requestId': req['id'], 'jobId': job, 'runId': claim['runId'], 'agentId': connection['agent']['id'], 'evidenceSha256': digest, 'status': 'passed'}
    finally:
        api('/agents/' + connection['agent']['id'], method='DELETE')
    helper('check', '--job', job, success=False)
    receipt['revocationVerified'] = True
    (root / 'acceptance.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'receipt': str(root / 'acceptance.json'), **receipt}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', required=True)
    parser.add_argument('--credentials', required=True)
    main(parser.parse_args())
