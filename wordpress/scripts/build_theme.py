#!/usr/bin/env python3
"""Build a WordPress theme from the current HTML without reserializing its markup."""
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'wordpress/build/bk-west-foundation'
PAGES = ['index', 'projekte', 'mitgliedschaft', 'sponsoren', 'impressum', 'datenschutz']
assets = set()
manifest = {}


def php_string(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def asset_url(value):
    parts = urlsplit(value)
    path = parts.path.removeprefix('./')
    source = (ROOT / path).resolve()
    if not source.is_relative_to(ROOT) or not source.is_file():
        raise ValueError(f'Missing or invalid asset: {value}')
    assets.add(path)
    suffix = ('?' + parts.query if parts.query else '') + ('#' + parts.fragment if parts.fragment else '')
    expr = 'get_theme_file_uri(' + php_string('/assets/' + path) + ')'
    if suffix:
        expr += ' . ' + php_string(suffix)
    return '<?php echo esc_url(' + expr + '); ?>'


def rewrite_url(value):
    value = html.unescape(value)
    if value.startswith(('#', '//')) or urlsplit(value).scheme:
        return None
    parts = urlsplit(value)
    path = parts.path.removeprefix('./')
    if path in ('', 'index.html') or path in [key + '.html' for key in PAGES]:
        key = 'index' if not path else path.removesuffix('.html')
        suffix = ('?' + parts.query if parts.query else '') + ('#' + parts.fragment if parts.fragment else '')
        return '<?php echo esc_url(bkw_page_url(' + php_string(key) + ') . ' + php_string(suffix) + '); ?>'
    return asset_url(value)


def attr(match):
    replacement = rewrite_url(match[3])
    if replacement is None:
        return match[0]
    return match[1] + '=' + match[2] + replacement + match[2]


def css_url(match):
    value = match[1].strip().strip('\"\'')
    if value.startswith(('#', '//')) or urlsplit(value).scheme:
        return match[0]
    return 'url("' + asset_url(value) + '")'


OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'views').mkdir(exist_ok=True)
for source in (ROOT / 'wordpress/theme').iterdir():
    if source.is_file():
        shutil.copy2(source, OUT / source.name)

for key in PAGES:
    source = ROOT / (key + '.html')
    content = source.read_text()
    if '<?' in content:
        raise ValueError('Unexpected PHP in HTML source')
    manifest[source.name] = hashlib.sha256(source.read_bytes()).hexdigest()
    content = re.sub(r'\b(href|src|poster)=([\"\'])(.*?)\2', attr, content)
    content = re.sub(r'\burl\(([^)]+)\)', css_url, content)
    content = content.replace('<meta name="robots" content="noindex, nofollow">', '')
    content = content.replace('https://bkwestunited.de/og-bild.jpg', asset_url('og-bild.jpg'))
    content = content.replace('</head>', '<?php wp_head(); ?></head>', 1)
    content = re.sub(r'(<body\b[^>]*>)', r'\1<?php wp_body_open(); ?>', content, count=1)
    content = content.replace('</body>', '<?php wp_footer(); ?></body>', 1)
    (OUT / 'views' / (key + '.php')).write_text("<?php defined('ABSPATH') || exit; ?>\n" + content)

# CSS keeps its relative URLs; preserve the matching asset directory structure.
for path in list(assets):
    if path.endswith('.css'):
        for value in re.findall(r'url\(([^)]+)\)', (ROOT / path).read_text()):
            value = value.strip().strip('\"\'')
            if not value.startswith(('#', '//')) and not urlsplit(value).scheme:
                assets.add(str(Path(path).parent / urlsplit(value).path))
for path in sorted(assets):
    source = ROOT / path
    target = OUT / 'assets' / path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    manifest[path] = hashlib.sha256(source.read_bytes()).hexdigest()
(OUT.parent / 'source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = OUT.parent / 'bk-west-foundation.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(OUT.rglob('*')):
        if path.is_file():
            z.write(path, path.relative_to(OUT.parent))
print(f'Theme built: {len(PAGES)} pages, {len(assets)} assets; {archive}')
