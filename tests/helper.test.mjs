import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('standalone helper preserves private state and uncertain submissions', () => {
  execFileSync('python3', [fileURLToPath(new URL('./helper_protocol.py', import.meta.url))], { stdio: 'pipe' });
});
