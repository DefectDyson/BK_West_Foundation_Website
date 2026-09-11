#!/usr/bin/env python3
"""Create separate local test credentials; never use a production password."""
from pathlib import Path
import os
import secrets

directory = Path('/tmp/bk-wordpress-preview')
directory.mkdir(exist_ok=True)
target = directory / 'local.env'
if not target.exists():
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        for key in ['DB', 'ROOT', 'ADMIN']:
            output.write(f'BK_PREVIEW_{key}_PASSWORD={secrets.token_urlsafe(32)}\n')
print(f'Local credentials: {target} (values not printed)')
