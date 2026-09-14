const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'local-agent');
const destination = path.join(root, 'public/downloads');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'h2h-local-agent-package-'));

try {
    const directory = path.join(temporary, 'happytohelp-local-agent');
    fs.mkdirSync(directory);
    // Package only the connector source, never a user's config, credentials,
    // runtime state, local browser profile, or development/test artifacts.
    for (const entry of ['package.json', 'package-lock.json', 'README.md', 'bin', 'lib', 'skills']) {
        const input = path.join(source, entry);
        if (!fs.existsSync(input)) {
            if (['package.json', 'README.md', 'bin', 'lib'].includes(entry)) {
                throw new Error(`Missing local connector source: ${entry}`);
            }
            continue;
        }
        fs.cpSync(input, path.join(directory, entry), { recursive: true, dereference: false });
    }
    const archive = path.join(temporary, 'happytohelp-local-agent.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', temporary, 'happytohelp-local-agent'], {
        env: { ...process.env, COPYFILE_DISABLE: '1' },
    });
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(archive, path.join(destination, path.basename(archive)));
    console.log(`Built local connector download (${fs.statSync(archive).size} bytes).`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
