const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// The connector download is a public asset inside the delivery artifact, so its
// bytes must depend only on the packaged source. Entries are sorted by code
// unit, owners are numeric root with no names, modes are normalized, and every
// entry carries npm pack's fixed timestamp (1985-10-26T08:15:00Z).
const FIXED_MTIME = 499162500;
const BLOCK = 512;

function octal(value, length) {
    return value.toString(8).padStart(length - 1, '0') + '\0';
}

function splitName(name) {
    if (Buffer.byteLength(name) <= 100) return { name, prefix: '' };
    const slash = name.lastIndexOf('/', name.length - 2);
    const prefix = name.slice(0, slash);
    const rest = name.slice(slash + 1);
    if (slash < 0 || Buffer.byteLength(prefix) > 155 || Buffer.byteLength(rest) > 100) {
        throw new Error(`Local connector path is too long for a portable tar entry: ${name}`);
    }
    return { name: rest, prefix };
}

function header(entry) {
    const block = Buffer.alloc(BLOCK);
    const { name, prefix } = splitName(entry.name);
    block.write(name, 0, 100);
    block.write(octal(entry.mode, 8), 100);
    block.write(octal(0, 8), 108);
    block.write(octal(0, 8), 116);
    block.write(octal(entry.data.length, 12), 124);
    block.write(octal(FIXED_MTIME, 12), 136);
    block.write(' '.repeat(8), 148);
    block.write(entry.directory ? '5' : '0', 156);
    block.write('ustar\0', 257);
    block.write('00', 263);
    block.write(prefix, 345, 155);
    let checksum = 0;
    for (const byte of block) checksum += byte;
    block.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
    return block;
}

function collect(directory, archiveName, entries) {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink()) throw new Error(`Local connector source cannot contain symlinks: ${directory}`);
    if (stat.isDirectory()) {
        entries.push({ name: `${archiveName}/`, mode: 0o755, directory: true, data: Buffer.alloc(0) });
        for (const child of fs.readdirSync(directory).sort()) collect(path.join(directory, child), `${archiveName}/${child}`, entries);
    } else if (stat.isFile()) {
        entries.push({ name: archiveName, mode: stat.mode & 0o111 ? 0o755 : 0o644, directory: false, data: fs.readFileSync(directory) });
    } else {
        throw new Error(`Unsupported local connector source entry: ${directory}`);
    }
}

// Returns gzip bytes for a tar holding `topLevel/` and the named `inputs`
// (paths relative to `source`).
function localAgentArchive({ source, topLevel, inputs }) {
    const entries = [{ name: `${topLevel}/`, mode: 0o755, directory: true, data: Buffer.alloc(0) }];
    for (const input of [...inputs].sort()) collect(path.join(source, input), `${topLevel}/${input}`, entries);
    const blocks = [];
    for (const entry of entries) {
        blocks.push(header(entry), entry.data);
        const padding = (BLOCK - (entry.data.length % BLOCK)) % BLOCK;
        if (padding) blocks.push(Buffer.alloc(padding));
    }
    blocks.push(Buffer.alloc(BLOCK * 2));
    const gzip = zlib.gzipSync(Buffer.concat(blocks), { level: 9 });
    // zlib records the build host's operating system in the gzip header.
    gzip[9] = 3;
    return gzip;
}

module.exports = { localAgentArchive, FIXED_MTIME };
