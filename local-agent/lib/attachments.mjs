import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { ConnectorError } from './errors.mjs';

const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
]);

export async function localScreenshot(filePath) {
  if (typeof filePath !== 'string' || !isAbsolute(filePath)) {
    throw new ConnectorError('Screenshot file_path must be an absolute local path.', { code: 'INVALID_ATTACHMENT' });
  }
  let filename;
  let source;
  let info;
  try {
    source = await realpath(filePath);
    info = await stat(source);
    filename = source.split('/').pop();
  } catch {
    throw new ConnectorError('Screenshot file is not available on this computer.', { code: 'INVALID_ATTACHMENT' });
  }
  if (!info.isFile() || info.size > MAX_SCREENSHOT_BYTES) {
    throw new ConnectorError('Screenshot must be a local image no larger than 4 MiB.', { code: 'INVALID_ATTACHMENT' });
  }
  const extension = `.${filename.split('.').pop().toLowerCase()}`;
  const type = IMAGE_TYPES.get(extension);
  if (!type) throw new ConnectorError('Screenshot must be a PNG, JPEG, or GIF file.', { code: 'INVALID_ATTACHMENT' });
  const data = await readFile(source);
  if (!imageMatches(type, data)) {
    throw new ConnectorError('Screenshot contents do not match its image type.', { code: 'INVALID_ATTACHMENT' });
  }
  return { data, filename, type };
}

function imageMatches(type, data) {
  if (type === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/jpeg') return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  return data.subarray(0, 6).equals(Buffer.from('GIF87a')) || data.subarray(0, 6).equals(Buffer.from('GIF89a'));
}
