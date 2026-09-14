const shellQuote = value => `'${ String(value).replaceAll("'", "'\\''") }'`;

const mcpWatchInstruction = [
    'Use h2h_wait_for_assignment to watch HappyToHelp assignments.',
    'When one arrives, follow its agent_guidance, read h2h_context, use this session\'s existing tools only as instructed, report concise progress, and submit h2h_result.',
    'Do not send customer replies directly.',
    'If recovery is required, submit a needs_input result explaining the interruption, receive the operator\'s review with h2h_input, and call h2h_recover before taking any action.',
].join(' ');

function buildLocalAgentCommands({ origin, projectId, provider = 'codex', name, code, session = false }) {
    const server = new URL(origin);
    const loopback = server.hostname === 'localhost' || server.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(server.hostname);
    if (server.protocol !== 'https:' && !(server.protocol === 'http:' && loopback)) throw new Error('The connector requires HTTPS outside this computer.');
    if (!/^[a-f\d-]{36}$/i.test(projectId)) throw new Error('A valid workspace is required.');
    if (!['codex', 'claude'].includes(provider)) throw new Error('Choose Codex or Claude.');

    const configuration = `"$HOME/.config/happytohelp/${ projectId }.json"`;
    const executable = '"$HOME/.local/share/happytohelp-local-agent/bin/h2h-local.mjs"';
    const scopedNode = `H2H_LOCAL_CONFIG=${ configuration } node ${ executable }`;
    const startCommand = `${ scopedNode } start`;
    const disconnectCommand = `${ scopedNode } disconnect`;
    const pairCommand = `${ scopedNode } ${ session ? 'connect' : 'start' } --server ${ shellQuote(server.origin) } --code ${ shellQuote(code || '') } --provider ${ provider } --name ${ shellQuote(name?.trim() || 'My computer') }`;
    const mcpCommand = provider === 'claude'
        ? `claude mcp add happytohelp-local --transport stdio --scope user --env H2H_LOCAL_CONFIG=${ configuration } -- node ${ executable } mcp`
        : `codex mcp add happytohelp-local --env H2H_LOCAL_CONFIG=${ configuration } -- node ${ executable } mcp`;

    const setupCommand = [
        '(',
        '  set -eu',
        '  command -v node >/dev/null || { printf "%s\\n" "Install Node.js 20 or later, then run this again."; exit 1; }',
        '  node -e \'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Update Node.js to version 20 or later, then run this again."); process.exit(1); }\'',
        `  command -v ${ provider } >/dev/null || { printf "%s\\n" ${ shellQuote(`Install ${ provider === 'codex' ? 'Codex CLI' : 'Claude Code' } first, then run this again.`) }; exit 1; }`,
        '  h2h_download_dir=$(mktemp -d)',
        '  trap \'rm -rf "$h2h_download_dir"\' EXIT',
        `  curl -fsSL ${ shellQuote(`${ server.origin }/downloads/happytohelp-local-agent.tar.gz`) } -o "$h2h_download_dir/connector.tar.gz"`,
        '  tar -xzf "$h2h_download_dir/connector.tar.gz" -C "$h2h_download_dir"',
        '  mkdir -p "$HOME/.local/share/happytohelp-local-agent"',
        '  cp -R "$h2h_download_dir/happytohelp-local-agent/." "$HOME/.local/share/happytohelp-local-agent/"',
        `  ${ pairCommand }`,
        ...(session ? [`  ${ mcpCommand }`] : []),
        ')',
    ].join('\n');

    return { setupCommand, startCommand, disconnectCommand, mcpCommand, mcpWatchInstruction };
}

function isWorkerReady(device) {
    return Boolean(device && !device.revoked_at && device.worker_ready === true);
}

function pairedDevice(devices, pairingId) {
    return pairingId ? devices.find(device => device.pairing_id === pairingId && !device.revoked_at) || null : null;
}

export { buildLocalAgentCommands, isWorkerReady, mcpWatchInstruction, pairedDevice, shellQuote };
