const fs = require('node:fs');
const path = require('node:path');
const { localAgentArchive } = require('./local-agent-archive.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'local-agent');
const destination = path.join(root, 'public/downloads');

// Package only the connector source, never a user's config, credentials,
// runtime state, local browser profile, or development/test artifacts.
const inputs = [];
for (const entry of ['package.json', 'package-lock.json', 'README.md', 'bin', 'lib', 'skills']) {
    if (fs.existsSync(path.join(source, entry))) inputs.push(entry);
    else if (['package.json', 'README.md', 'bin', 'lib'].includes(entry)) throw new Error(`Missing local connector source: ${entry}`);
}
const archive = localAgentArchive({ source, topLevel: 'happytohelp-local-agent', inputs });
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'happytohelp-local-agent.tar.gz'), archive);
console.log(`Built local connector download (${archive.length} bytes).`);
