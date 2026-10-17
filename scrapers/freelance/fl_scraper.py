"""
Scraper for FL.ru freelance tasks via official high-speed XML RSS feed.
"""
import re
import html
import xml.etree.ElementTree as ET
from typing import List, Dict, Any
import httpx
from scrapers.freelance.config import FL_RELEVANT_KEYWORDS, FL_EXCLUDED_KEYWORDS

FL_RSS_URL = "https://www.fl.ru/rss/all.xml"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def clean_html(raw_html: str) -> str:
    """Strip HTML tags and unescape HTML entities."""
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, ' ', raw_html)
    return html.unescape(cleantext).strip()

def is_relevant_task(title: str, description: str) -> bool:
    """Check if freelance project matches our IT development target."""
    full_text = f"{title} {description}".lower()
    
    # Exclude non-IT
    for exc in FL_EXCLUDED_KEYWORDS:
        if exc in full_text and not any(k in full_text for k in ["бот", "bot", "python", "скрипт"]):
            return False
            
    # Include relevant IT keywords
    return any(keyword in full_text for keyword in FL_RELEVANT_KEYWORDS)

def extract_budget(text: str) -> str | None:
    """Extract budget from task title/description."""
    match = re.search(r'Бюджет:\s*([\d\s]+(?:&#8381;|₽|руб|\$))', text, re.I)
    if match:
        raw = match.group(1).replace('&#8381;', '₽').strip()
        return raw
    return None

async def fetch_fl_tasks(client: httpx.AsyncClient, max_items: int = 30) -> List[Dict[str, Any]]:
    """
    Fetch and parse active projects from FL.ru RSS feed.
    """
    try:
        resp = await client.get(FL_RSS_URL, headers=HEADERS, timeout=15.0)
        if resp.status_code != 200:
            print(f"[WARN] [FL.ru] Не удалось получить RSS: HTTP {resp.status_code}")
            return []

        root = ET.fromstring(resp.content)
        items = root.findall('.//item')
        results = []

        for item in items:
            title_node = item.find('title')
            link_node = item.find('link')
            desc_node = item.find('description')
            pubdate_node = item.find('pubDate')

            if title_node is None or link_node is None:
                continue

            raw_title = title_node.text or ""
            link = link_node.text or ""
            raw_desc = desc_node.text or "" if desc_node is not None else ""
            pub_date = pubdate_node.text or "" if pubdate_node is not None else ""

            # Extract project ID from URL (e.g. /projects/5525659/...)
            id_match = re.search(r'/projects/(\d+)/', link)
            task_id = id_match.group(1) if id_match else None
            if not task_id:
                continue

            cleaned_desc = clean_html(raw_desc)
            cleaned_title = clean_html(raw_title)

            # Check relevance for Bots, Python, LLM, Automation
            if not is_relevant_task(cleaned_title, cleaned_desc):
                continue

            budget = extract_budget(raw_title) or extract_budget(raw_desc)

            results.append({
                "id": f"fl_{task_id}",
                "title": cleaned_title,
                "url": link,
                "description": cleaned_desc,
                "salary": budget,
                "company": "Заказчик на FL.ru",
                "source": "fl_ru",
                "pub_date": pub_date
            })

            if len(results) >= max_items:
                break

        return results
    except Exception as e:
        print(f"[ERR] [FL.ru] Ошибка при парсинге RSS: {e}")
        return []
