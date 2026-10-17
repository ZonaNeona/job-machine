"""
Scraper for Kwork Exchange (kwork.ru/projects) via official internal AJAX JSON endpoint.
Fetches direct freelance IT projects, extracts budgets, descriptions and client profiles.
"""
import re
import html
from typing import List, Dict, Any, Optional
import httpx

KWORK_PROJECTS_URL = "https://kwork.ru/projects"
BASE_URL = "https://kwork.ru"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

DEFAULT_KEYWORDS = ["telegram", "python", "бот", "парсер", "ai", "fastapi", "автоматизация"]

def clean_html_text(raw_text: str) -> str:
    """Strip HTML tags and clean up whitespace."""
    if not raw_text:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', raw_text)
    return html.unescape(clean).strip()

async def fetch_kwork_projects(
    client: httpx.AsyncClient,
    keywords: Optional[List[str]] = None,
    min_budget: int = 3000,
    max_items: int = 30
) -> List[Dict[str, Any]]:
    """
    Fetch active IT projects from Kwork exchange matching our target keywords.
    """
    if keywords is None:
        keywords = DEFAULT_KEYWORDS

    collected_by_id = {}

    for kw in keywords:
        payload = {
            "c": 11,  # Category: Разработка и IT
            "page": 1,
            "keyword": kw
        }

        try:
            resp = await client.post(KWORK_PROJECTS_URL, data=payload, headers=HEADERS, timeout=15.0)
            if resp.status_code != 200:
                print(f"[WARN] [Kwork] Ошибка запроса по ключу '{kw}': HTTP {resp.status_code}")
                continue

            json_data = resp.json()
            pagination = json_data.get("data", {}).get("pagination", {})
            wants = pagination.get("data", [])

            for item in wants:
                want_id = item.get("id")
                if not want_id or want_id in collected_by_id:
                    continue

                raw_title = item.get("name") or item.get("title") or ""
                title = clean_html_text(raw_title)

                raw_desc = item.get("description") or ""
                desc = clean_html_text(raw_desc)

                # Extract budget
                possible_price = item.get("possiblePriceLimit")
                limit_price = item.get("priceLimit")
                budget_num = possible_price or limit_price

                try:
                    budget_val = float(budget_num) if budget_num else 0
                except (ValueError, TypeError):
                    budget_val = 0

                # Format salary string
                if budget_val > 0:
                    salary_str = f"{int(budget_val):,} ₽".replace(",", " ")
                else:
                    salary_str = "По договоренности"

                # Client user info
                user_obj = item.get("user") or {}
                username = user_obj.get("username", "Заказчик Kwork")

                project_url = f"{BASE_URL}/projects/{want_id}"

                collected_by_id[want_id] = {
                    "id": f"kwork_{want_id}",
                    "title": title,
                    "company": f"Kwork (@{username})",
                    "description": desc,
                    "url": project_url,
                    "salary": salary_str,
                    "budget_val": budget_val,
                    "source": "kwork",
                    "tags": f"Kwork, {kw.capitalize()}, IT-разработка"
                }

        except Exception as e:
            print(f"[ERR] [Kwork] Ошибка при сборе по ключу '{kw}': {e}")

    # Sort by budget descending
    sorted_projects = sorted(
        collected_by_id.values(),
        key=lambda x: x.get("budget_val", 0),
        reverse=True
    )

    return sorted_projects[:max_items]
