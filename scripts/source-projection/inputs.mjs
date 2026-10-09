import fs from 'node:fs';
import path from 'node:path';

export function originalInputPath(filename, kind = 'file') {
  // Inspect the supplied spelling before resolving '..': a linked component
  // must not disappear through lexical normalization. lstat also sees dangling
  // links, for which existsSync would incorrectly report a missing input.
  const absolute = path.isAbsolute(filename) ? filename : process.cwd() + path.sep + filename;
  const root = path.parse(absolute).root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  let current = root;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw Error('Symlink in original archive input path');
    const directory = index < parts.length - 1 || kind === 'directory';
    if (directory ? !stat.isDirectory() : !stat.isFile()) throw Error('Original archive input has unsupported file type');
  }
  if (!parts.length && kind !== 'directory') throw Error('Original archive input must be a regular file');
  return current;
}

export function readOriginalFile(filename) {
  const checked = originalInputPath(filename);
  const descriptor = fs.openSync(checked, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw Error('Original archive input must be a regular file');
    return fs.readFileSync(descriptor);
  } finally {fs.closeSync(descriptor);}
}

export function originalInputFiles(directory, pins) {
  const checked = originalInputPath(directory, 'directory');
  const names = fs.readdirSync(checked);
  // Check every entry, including unexpected and dangling links, before any
  // archive is read. A directory with extra files is not the pinned input set.
  for (const name of names) originalInputPath(path.join(checked, name));
  const expected = pins.map(pin => pin.key + '.json');
  if (names.length !== expected.length || names.some(name => !expected.includes(name))) {
    throw Error('Original archive directory inventory does not match pinned inputs');
  }
  return expected.map(name => path.join(checked, name));
}
