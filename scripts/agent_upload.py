"""Read bounded local screenshot evidence, never remote content."""
from pathlib import Path
import base64


def screenshot(path):
    source = Path(path)
    if not source.is_absolute() or source.is_symlink() or not source.is_file():
        raise ValueError('Screenshot must be an absolute local regular file, not a symlink.')
    with source.open('rb') as handle:
        data = handle.read(4 * 1024 * 1024 + 1)
    if len(data) > 4 * 1024 * 1024:
        raise ValueError('Screenshot exceeds 4 MiB.')
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        mime = 'image/png'
    elif data.startswith(b'\xff\xd8\xff'):
        mime = 'image/jpeg'
    elif data.startswith((b'GIF87a', b'GIF89a')):
        mime = 'image/gif'
    else:
        raise ValueError('Only PNG, JPEG or GIF screenshots are supported.')
    return {'bytes': base64.b64encode(data).decode(), 'mime': mime}
