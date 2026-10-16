# Fetches each tool's icon for the Tools page (data/tools.json) into img/tools/<slug>.webp, 64 px, so the page loads
# them from the site itself. Only icons that aren't there yet are fetched:
#   python -I scripts/tool-icons.py            (add --all to fetch them all again)
import io, json, re, sys, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
out = root / 'img' / 'tools'
out.mkdir(parents=True, exist_ok=True)
data = json.loads((root / 'data' / 'tools.json').read_text(encoding='utf8'))
slug = lambda n: re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
missing = []
for t in data['tools']:
    f = out / f"{slug(t['n'])}.webp"
    if f.exists() and '--all' not in sys.argv:
        continue
    host = t.get('icon') or urllib.parse.urlparse(t['u']).hostname
    url = f'https://www.google.com/s2/favicons?domain={host}&sz=128'
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).read()
        im = Image.open(io.BytesIO(raw)).convert('RGBA')
        if im.width < 32:
            missing.append(f"{t['n']} (only {im.width}px)")
        im.resize((64, 64), Image.LANCZOS).save(f, 'WEBP', quality=90, method=6)
        print('ok', f.name, im.size)
    except Exception as e:
        missing.append(f"{t['n']} ({e})")
if missing:
    print('check these:', *missing, sep='\n  ')
