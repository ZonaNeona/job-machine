import httpx
import json

res = httpx.post(
    'https://kwork.ru/projects',
    data={'page': 1},
    headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
    },
    timeout=15
)

data = res.json()
pagination = data.get("data", {}).get("pagination", {})
wants = pagination.get("data", [])
print(f"Total projects on page: {len(wants)}")

if wants:
    first = wants[0]
    print("\nFirst want keys:", list(first.keys()))
    print("ID:", first.get("id"))
    print("Title:", first.get("title") or first.get("name"))
    print("Price / Budget:", first.get("priceLimit"), first.get("possiblePriceLimit"))
    print("Description:", (first.get("description") or "")[:200])
    print("Category:", first.get("category_id"), first.get("parent_category_id"))
    print("User / Buyer:", first.get("username") or first.get("user"))
    print("\nFull sample want object:")
    print(json.dumps(first, ensure_ascii=False, indent=2)[:800])
