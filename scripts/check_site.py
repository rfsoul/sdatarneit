"""Validate local HTML links, assets and SEO shape without a browser."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
ROOT=Path(__file__).resolve().parents[1]/'dist'
class Page(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.ids=set();self.alts=[];self.h1=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.add(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='img':self.alts.append(a.get('alt'))
        for key in ('src','href'):
            if key in a:self.links.append(a[key])
        if 'srcset' in a:self.links.extend(part.strip().split()[0] for part in a['srcset'].split(','))
pages={}
for file in ROOT.rglob('*.html'):
    p=Page();p.feed(file.read_text(encoding='utf-8'));pages[file]=p
errors=[]
for file,p in pages.items():
    if p.h1!=1:errors.append(f'{file}: expected one H1')
    if any(alt is None for alt in p.alts):errors.append(f'{file}: missing image alt')
    for link in p.links:
        u=urlsplit(link)
        if u.scheme or u.netloc:continue
        target=(ROOT/unquote(u.path).lstrip('/')) if u.path.startswith('/') else file.parent/unquote(u.path)
        if not u.path:target=file
        if target.is_dir():target=target/'index.html'
        if not target.exists():errors.append(f'{file}: broken link {link}')
        elif u.fragment and target in pages and u.fragment not in pages[target].ids:errors.append(f'{file}: missing anchor {link}')
assert not errors,'\n'.join(errors)
assert not any(p.stat().st_size>50_000_000 for p in ROOT.rglob('*') if p.is_file()),'Oversized file in public output'
selected=[p for p in (ROOT.parent/'ref/production/stills-1s - keep').iterdir() if p.suffix.lower() in ['.jpg','.jpeg','.png']]
assert len(json.loads((ROOT/'assets/gallery.json').read_text()))==len(selected)
print(f'PASS: {len(pages)} HTML files, local links, fragments, image alts, selected-photo count and public file-size guard.')
