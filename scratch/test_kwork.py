import httpx
import re

r = httpx.get('https://kwork.ru/projects', headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

# Find script URLs
scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', r.text)
app_scripts = [s for s in scripts if 'project' in s or 'app' in s or 'wants' in s or 'chunk' in s]
print('Found scripts:', len(app_scripts))
for s in app_scripts[:10]:
    print(' ', s)

# Let's test standard Kwork project AJAX endpoint:
# In Kwork, the projects list is loaded via POST /projects or /wants
test_endpoints = [
    ('POST', 'https://kwork.ru/projects', {'page': 1}),
    ('POST', 'https://kwork.ru/wants', {'page': 1}),
    ('GET', 'https://kwork.ru/api/projects', {}),
    ('POST', 'https://kwork.ru/api/projects', {'page': 1}),
]

for method, url, data in test_endpoints:
    try:
        if method == 'POST':
            res = httpx.post(url, data=data, headers={'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest'}, timeout=10)
        else:
            res = httpx.get(url, params=data, headers={'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest'}, timeout=10)
        print(f'{method} {url} -> {res.status_code} ({len(res.text)} bytes)')
        if res.status_code == 200 and ('json' in res.headers.get('content-type', '') or res.text.startswith('{')):
            print('  JSON snippet:', res.text[:200])
    except Exception as e:
        print(f'{method} {url} -> ERR: {e}')
