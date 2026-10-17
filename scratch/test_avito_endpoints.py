import httpx

urls = [
    ("m.avito.ru HTML", "https://m.avito.ru/rossiya/vakansii?q=python", {"User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"}),
    ("m.avito.ru API 1", "https://m.avito.ru/api/9/items?query=python&categoryId=111", {"User-Agent": "Avito/105.1 (Android; 14; ru_RU)", "X-App-Version": "105.1"}),
    ("m.avito.ru API 2", "https://m.avito.ru/api/11/items?query=telegram&categoryId=111", {"User-Agent": "Avito/105.1 (Android; 14; ru_RU)", "X-App-Version": "105.1"}),
    ("www.avito.ru Web", "https://www.avito.ru/rossiya/vakansii?q=python", {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
]

for name, url, headers in urls:
    try:
        r = httpx.get(url, headers=headers, follow_redirects=True, timeout=10)
        print(f"{name} -> HTTP {r.status_code} ({len(r.text)} bytes)")
        if r.status_code == 200:
            print(f"   Snippet: {r.text[:200]}")
    except Exception as e:
        print(f"{name} -> Error: {e}")
