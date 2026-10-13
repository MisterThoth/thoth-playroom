#!/usr/bin/env python3
"""Concatenate src/ parts into a single-file game.

Outputs:
  thoth-playroom.html  - claude.ai artifact version (no doctype/html/head/body; the host wraps it). three.js comes
                         from the jsDelivr CDN here: the artifact is at its file cap, so vendor/ is not published
  web/index.html       - the public website (GitHub Pages, MisterThoth/thoth-playroom): a full document that loads
                         three.js, Trystero and mqtt.js from ./vendor/ (online multiplayer works there)
  thoth-playroom-lokal.html, dev.html - full standalone documents for local testing (vendor/ next to them)
"""
import pathlib, sys

root = pathlib.Path(__file__).parent
src = root / 'src'
head = (src / '00_head.html').read_text(encoding='utf-8')
parts = sorted(p for p in src.glob('*.js'))
# 14_main.js boots the game, so it goes last: every part after it in name order (15_arena*.js,
# the Arena 5v5 mode) is then fully defined before boot() runs
# (14n_net.js, the online layer, wraps the Arena's and the items' classes at load: it goes after them, right before 14_main.js)
parts.sort(key=lambda p: (p.name == '14_main.js', p.name == '14n_net.js', p.name))
skip = set(sys.argv[1:])
js = []
for p in parts:
    if p.name in skip:
        continue
    js.append(f'// ---- {p.name} ----\n' + p.read_text(encoding='utf-8'))
script = '<script type="module">\n' + '\n'.join(js) + '\n</script>\n'
page = head + '\n' + script
VENDOR = '"three": "./vendor/three/build/three.module.js",\n  "three/addons/": "./vendor/three/examples/jsm/"'
CDN = ('"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",\n'
       '  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"')
assert VENDOR in page, 'importmap not found in 00_head.html'
artifact = page.replace(VENDOR, CDN)
(root / 'thoth-playroom.html').write_text(artifact, encoding='utf-8')
# the same document skeleton the artifact host wraps the page in (the published site is what the cloud session shipped)
SKEL = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,'
        'viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);'
        'padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;'
        'padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}'
        '[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n')
(root / 'web').mkdir(exist_ok=True)
(root / 'web' / 'index.html').write_text(SKEL + page + '\n</body></html>\n', encoding='utf-8')
dev = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       '</head>\n<body>\n' + page + '</body>\n</html>\n')
(root / 'thoth-playroom-lokal.html').write_text(dev, encoding='utf-8')
(root / 'dev.html').write_text(dev, encoding='utf-8')
print(f'built {len(parts) - len(skip)} parts, {len(artifact) / 1024:.0f} KB')
