import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'agent.py'
sys.dont_write_bytecode = True
sys.path.insert(0, str(SCRIPT.parent))
from agent_transport import origin
from agent_upload import screenshot


class Protocol(unittest.TestCase):
    def test_screenshot_bounds_and_signature(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / 'evidence.png'
            image.write_bytes(b'\x89PNG\r\n\x1a\n' + b'evidence')
            self.assertEqual(screenshot(str(image))['mime'], 'image/png')
            image.write_bytes(b'not a screenshot')
            with self.assertRaises(ValueError): screenshot(str(image))
            image.write_bytes(b'\x89PNG\r\n\x1a\n' + bytes(4 * 1024 * 1024))
            with self.assertRaises(ValueError): screenshot(str(image))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'workspace').mkdir()
        (self.root / 'token.json').write_text(json.dumps({'token': 'private-test-token'}))
        (self.root / 'token.json').chmod(0o600)
        self.events = []
        self.drop = False
        outer = self

        class API(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                self.reply({'agent': {'id': 'a1', 'name': 'test', 'workspaceIds': ['w1']}})

            def do_POST(self):
                raw = self.rfile.read(int(self.headers['Content-Length']))
                if self.headers.get('Content-Type', '').startswith('image/'):
                    outer.events.append((self.path, raw))
                    self.reply({'attachmentId': 'evidence-1'})
                    return
                body = json.loads(raw)
                outer.events.append((self.path, body))
                if self.path.endswith('/claim'):
                    self.reply({'job': {'id': 'j1', 'runId': 'r1'}, 'runId': 'r1'})
                elif outer.drop:
                    outer.drop = False
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                else:
                    self.reply({'receipt': body.get('eventId')})

            def reply(self, body):
                if self.headers.get('Authorization') != 'Bearer private-test-token' or self.headers.get('User-Agent') != 'HappyToHelp-Agent/0.1':
                    self.send_error(401)
                    return
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(body).encode())

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), API)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.call('connect', '--server', f'http://127.0.0.1:{self.server.server_port}', '--session', 'session-1', '--token-file', str(self.root / 'token.json'), '--workspace', str(self.root / 'workspace'))

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def call(self, *args, success=True):
        process = subprocess.run([sys.executable, str(SCRIPT), '--state', str(self.root / 'state.json'), *args], text=True, capture_output=True)
        self.assertNotIn('private-test-token', process.stdout + process.stderr)
        self.assertEqual(process.returncode == 0, success, process.stderr)
        return json.loads(process.stdout if success else process.stderr)

    def test_upload_preserves_local_screenshot_bytes(self):
        self.call('claim')
        image = self.root / 'screenshot.png'
        data = b'\x89PNG\r\n\x1a\n' + b'local evidence'
        image.write_bytes(data)
        response = self.call('upload', '--job', 'j1', '--file', str(image))
        self.assertEqual(response['attachmentId'], 'evidence-1')
        self.assertEqual(self.events[-1][1], data)
        self.assertIn('/attachments?runId=r1', self.events[-1][0])

    def test_unknown_outcome_replays_identical_event(self):
        self.call('claim')
        self.drop = True
        self.call('progress', '--job', 'j1', '--message', 'Verified local files', success=False)
        state = json.loads((self.root / 'state.json').read_text())
        pending = state['pending']
        self.assertTrue(pending['body']['eventId'])
        self.call('progress', '--job', 'j1', '--message', 'replacement', success=False)
        self.call('retry')
        self.assertEqual(self.events[-2], self.events[-1])
        after = json.loads((self.root / 'state.json').read_text())
        self.assertNotIn('pending', after)
        self.assertEqual(after['receipts'][-1]['submission'], pending)
        self.assertEqual((self.root / 'state.json').stat().st_mode & 0o777, 0o600)

    def test_scope_inventory_and_verified_result(self):
        self.call('claim')
        self.call('check', '--job', 'unknown', success=False)
        result = self.root / 'result.json'
        result.write_text(json.dumps({'status': 'completed', 'result': {'verified': False}}))
        result.chmod(0o600)
        self.call('result', '--job', 'j1', '--file', str(result), success=False)
        (self.root / 'workspace').rmdir()
        self.call('inventory', success=False)
        self.call('claim', success=False)

    def test_private_input_required(self):
        self.call('claim')
        result = self.root / 'result.json'
        result.write_text('{}')
        result.chmod(0o644)
        self.call('result', '--job', 'j1', '--file', str(result), success=False)

    def test_state_symlink_is_refused(self):
        state = self.root / 'state.json'
        private = self.root / 'saved.json'
        state.rename(private)
        before = private.read_bytes()
        state.symlink_to(private)
        self.call('inventory', success=False)
        self.assertEqual(private.read_bytes(), before)

    def test_origin_restrictions(self):
        for value in ['http://example.com', 'https://a:b@example.com', 'https://example.com/path', 'https://example.com?secret=x']:
            with self.assertRaises(ValueError):
                origin(value)
        self.assertEqual(origin('https://example.com/'), 'https://example.com')


if __name__ == '__main__':
    unittest.main()
