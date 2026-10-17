import httpx

for kw in ['telegram', 'python', 'бот', 'парсер']:
    payload = {'c': 11, 'page': 1, 'keyword': kw}
    res = httpx.post(
        'https://kwork.ru/projects',
        data=payload,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        },
        timeout=15
    )
    if res.status_code == 200:
        data = res.json()
        wants = data.get("data", {}).get("pagination", {}).get("data", [])
        print(f"Keyword '{kw}' -> {len(wants)} projects")
        for w in wants[:3]:
            price = w.get("possiblePriceLimit") or w.get("priceLimit")
            print(f"   ID {w.get('id')} | Price: {price} | Title: {w.get('name')}")
