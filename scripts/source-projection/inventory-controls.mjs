// Authentic private controls mutate disposable copies, never custody originals.
import fs from 'node:fs';
import path from 'node:path';

export function verifyInventoryInputs(regular, temporary, pins, reject) {
  const names = pins.map(pin => pin.key + '.json');
  const inventory = /Original archive directory inventory does not match pinned inputs/;
  const controls = [
    ...names.map((name, index) => ['missing-' + index, directory => fs.unlinkSync(path.join(directory, name)), inventory]),
    ['extra-archive', directory => fs.copyFileSync(path.join(directory, names[0]), path.join(directory, '0'.repeat(64) + '.json')), inventory],
    ['malformed-name', directory => fs.copyFileSync(path.join(directory, names[0]), path.join(directory, 'archive.json')), inventory],
    ['hidden-file', directory => fs.writeFileSync(path.join(directory, '.DS_Store'), '', {mode: 0o600}), inventory],
    ['substituted-name', directory => fs.renameSync(path.join(directory, names[0]), path.join(directory, 'unexpected.json')), inventory],
    ['extra-directory', directory => fs.mkdirSync(path.join(directory, 'nested'), {mode: 0o700}), /unsupported file type/],
    ['pinned-directory', directory => {fs.unlinkSync(path.join(directory, names[0])); fs.mkdirSync(path.join(directory, names[0]), {mode: 0o700});}, /unsupported file type/],
    ['extra-symlink', directory => fs.symlinkSync(path.join(directory, names[0]), path.join(directory, 'linked.json')), /Symlink in original archive input path/],
    ['extra-dangling-symlink', directory => fs.symlinkSync(path.join(directory, 'absent'), path.join(directory, 'dangling.json')), /Symlink in original archive input path/],
    ['duplicated-archive', directory => fs.copyFileSync(path.join(directory, names[0]), path.join(directory, names.at(-1))), /filename does not match pinned identity/],
    ['swapped-archives', directory => {
      const first = fs.readFileSync(path.join(directory, names[0]));
      fs.copyFileSync(path.join(directory, names[1]), path.join(directory, names[0]));
      fs.writeFileSync(path.join(directory, names[1]), first);
    }, /filename does not match pinned identity/],
    ['altered-last-archive', directory => fs.appendFileSync(path.join(directory, names.at(-1)), '\n'), /byte-exact custody pin/],
  ];
  for (const [label, change, error] of controls) {
    const directory = path.join(temporary, 'inventory-' + label);
    fs.mkdirSync(directory, {mode: 0o700});
    for (const name of names) fs.copyFileSync(path.join(regular, name), path.join(directory, name));
    change(directory);
    reject(directory, error, label);
  }
  return controls.map(([label]) => label);
}
