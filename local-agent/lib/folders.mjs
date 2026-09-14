import { realpath, stat } from 'node:fs/promises';

export async function validateWorkspaceFolders(value) {
  if (value === undefined || value === null) return { folders: [], problems: [] };
  if (!Array.isArray(value)) return { folders: [], problems: ['The server returned invalid suggested workspace folders.'] };

  const folders = [];
  const problems = [];
  for (const raw of value) {
    if (typeof raw !== 'string' || !raw || !raw.startsWith('/')) {
      problems.push('A suggested workspace folder is not an absolute local path.');
      continue;
    }
    try {
      const resolved = await realpath(raw);
      if (!(await stat(resolved)).isDirectory()) throw new Error('not a directory');
      folders.push(resolved);
    } catch {
      problems.push(`Suggested workspace folder is unavailable on this computer: ${raw}`);
    }
  }
  return { folders: [...new Set(folders)], problems };
}
