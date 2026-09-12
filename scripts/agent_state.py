"""Private, atomic, single-writer state for the standalone agent helper."""
import fcntl
import json
import os
from pathlib import Path
import tempfile


class State:
    def __init__(self, path):
        self.path = Path(path).expanduser().absolute()

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        flags = os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW
        self.lock = os.fdopen(os.open(str(self.path) + '.lock', flags, 0o600), 'r+')
        os.fchmod(self.lock.fileno(), 0o600)
        fcntl.flock(self.lock, fcntl.LOCK_EX)
        self.data = {'version': 1, 'jobs': {}, 'receipts': []}
        try:
            fd = os.open(self.path, os.O_RDONLY | os.O_NOFOLLOW)
        except FileNotFoundError:
            return self
        with os.fdopen(fd) as source:
            if os.fstat(source.fileno()).st_mode & 0o077:
                raise ValueError('State must be private (chmod 600).')
            self.data = json.load(source)
        return self

    def save(self):
        fd, name = tempfile.mkstemp(prefix='.agent-', dir=self.path.parent)
        try:
            with os.fdopen(fd, 'w') as target:
                os.fchmod(target.fileno(), 0o600)
                json.dump(self.data, target, indent=2)
                target.write('\n')
                target.flush()
                os.fsync(target.fileno())
            os.replace(name, self.path)
            directory = os.open(self.path.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            if os.path.exists(name):
                os.unlink(name)

    def __exit__(self, *args):
        self.lock.close()


def private_json(path):
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW)) as source:
        if os.fstat(source.fileno()).st_mode & 0o077:
            raise ValueError('Input must be private (chmod 600).')
        return json.load(source)


def inventory(paths):
    """Validate actual directories; never infer a capability from a label."""
    result = []
    for supplied in paths:
        root = Path(supplied).expanduser().resolve(strict=True)
        if not root.is_dir():
            raise ValueError('Workspace must be an existing directory.')
        # Attempt a real read rather than trusting access bits.
        with os.scandir(root) as entries:
            next(entries, None)
        value = {'path': str(root), 'name': root.name}
        if value not in result:
            result.append(value)
    if not result:
        raise ValueError('At least one accessible workspace is required.')
    return result
