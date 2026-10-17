import httpx

for cat_param in [
    {'c': 11},
    {'c': 'all'},
    {'categories': [11]},
    {'parent_category_id': 11},
]:
    payload = {'page': 1}
    payload.update(cat_param)
    res = httpx.post(
        'https://kwork.ru/projects',
        data=payload,
        headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
        },
        timeout=15
    )
    if res.status_code == 200:
        data = res.json()
        wants = data.get("data", {}).get("pagination", {}).get("data", [])
        print(f"Param {cat_param} -> {len(wants)} projects")
        if wants:
            sample = wants[0]
            print(f"  Sample: ID {sample.get('id')}, Cat: {sample.get('category_id')}, Name: {sample.get('name')}")
