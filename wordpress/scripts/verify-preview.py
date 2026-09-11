#!/usr/bin/env python3
"""Verify exact screenshot pixels, local routes and copied asset bytes."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.parse import urlsplit, urlunsplit, unquote, urljoin
from urllib.request import urlopen

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/tmp/bk-wordpress-preview/check')
data = json.loads((OUT / 'results.json').read_text())
manifest = json.loads((ROOT / 'wordpress/build/source-manifest.json').read_text())
for path, expected in manifest.items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, f'Source changed: {path}'

class Document(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.ids = set()
        self.noindex = False
        self.feed(content)

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'meta' and attrs.get('name') == 'robots' and 'noindex' in attrs.get('content', ''):
            self.noindex = True

cache = {}
def fetch(url):
    assert urlsplit(url).netloc == 'localhost:8766', 'Only the local preview may be fetched'
    if url not in cache:
        with urlopen(url, timeout=15) as response:
            assert response.status == 200
            assert urlsplit(response.url).netloc == 'localhost:8766', 'Unexpected remote redirect'
            cache[url] = response.read()
    return cache[url]

pixel_results = []
links = set()
assets = set()
for result in data['results']:
    name = f"{result['page']}-{result['width']}"
    with Image.open(OUT / f'{name}-html.png') as original, Image.open(OUT / f'{name}-wordpress.png') as converted:
        assert original.size == converted.size, f'Screenshot size differs: {name}'
        diff = ImageChops.difference(original.convert('RGB'), converted.convert('RGB'))
        box = diff.getbbox()
        if box:
            diff.save(OUT / f'{name}-difference.png')
        assert box is None, f'Screenshot pixels differ: {name}, {box}'
        pixel_results.append({'page':result['page'], 'width':result['width'], 'size':original.size, 'differentPixels':0})
    links.update(link['href'] for link in result['links'] if urlsplit(link['href']).netloc == 'localhost:8766')
    assets.update(result['assets'])

documents = {}
for link in sorted(links):
    parts = urlsplit(link)
    url = urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ''))
    if url not in documents:
        documents[url] = Document(fetch(url).decode())
    assert documents[url].noindex, f'Preview indexable: {url}'
    if parts.fragment:
        assert unquote(parts.fragment) in documents[url].ids, f'Broken local anchor: {link}'

prefix = 'http://localhost:8766/wp-content/themes/bk-west-foundation/assets/'
for asset in sorted(assets):
    assert asset.startswith(prefix), f'Asset not served from local theme: {asset}'
    relative = unquote(urlsplit(asset).path.split('/assets/',1)[1])
    assert fetch(asset) == (ROOT / relative).read_bytes(), f'Asset bytes changed: {asset}'

# Verify fonts and every other packaged asset, including CSS dependencies.
for path in (ROOT / 'wordpress/build/bk-west-foundation/assets').rglob('*'):
    if path.is_file():
        relative = path.relative_to(ROOT / 'wordpress/build/bk-west-foundation/assets').as_posix()
        assert fetch(urljoin(prefix,relative)) == (ROOT / relative).read_bytes(), f'Packaged asset changed: {relative}'

try:
    urlopen('http://localhost:8766/bkw-pruefung-nicht-vorhanden/', timeout=10)
except HTTPError as error:
    assert error.code == 404, f'Unexpected missing-page status: {error.code}'
else:
    raise AssertionError('Missing page did not return HTTP 404')

report = {
    'pageViewportComparisons':len(pixel_results),
    'differentPixels':0,
    'pixelResults':pixel_results,
    'localLinksChecked':len(links),
    'localPagesChecked':len(documents),
    'sourceFilesUnchanged':len(manifest),
    'existingLayoutIssues':[{'page':r['page'],'viewport':r['width'],'scrollWidth':r['scrollWidth'],'issue':'Horizontal overflow also present in the original HTML'} for r in data['results'] if r['existingOverflow']],
    'runtimeErrors':data['runtimeErrors'],
    'failedResponses':data['failedResponses'],
    'scope':'Local WordPress without the existing Strato plugins; external payments and video playback not performed.'
}
(OUT / 'verification.json').write_text(json.dumps(report,indent=2)+'\n')
(OUT / 'index.html').write_text((ROOT / 'wordpress/report-template.html').read_text().replace('/*REPORT_DATA*/',json.dumps(report).replace('<','\\u003c')))
print(json.dumps({k:v for k,v in report.items() if k!='pixelResults'},indent=2))
