"""
Scraper for Habr Career (career.habr.com) - direct developer vacancies & contract work.
"""
import sys
import re
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

BASE_URL = "https://career.habr.com"

async def search_habr_vacancies(
    client: httpx.AsyncClient, 
    query: str = "python", 
    vacancy_type: str = "contract", 
    max_items: int = 15
) -> List[Dict[str, Any]]:
    """
    Search vacancies on career.habr.com.
    """
    params = {
        "q": query,
    }
    if vacancy_type:
        params["type"] = vacancy_type

    url = f"{BASE_URL}/vacancies"
    try:
        resp = await client.get(url, params=params, headers=HEADERS, timeout=15.0)
        if resp.status_code != 200:
            print(f"[WARN] [Habr] Не удалось загрузить поиск {url}: HTTP {resp.status_code}")
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select(".vacancy-card")
        results = []

        for card in cards[:max_items]:
            title_elem = card.select_one(".vacancy-card__title-link")
            if not title_elem:
                continue

            title = title_elem.text.strip()
            link = title_elem.get("href", "")
            if not link.startswith("http"):
                link = f"{BASE_URL}{link}"

            # Extract vacancy ID from link
            match_id = re.search(r'/vacancies/(\d+)', link)
            v_id = match_id.group(1) if match_id else None
            if not v_id:
                continue

            # Company
            company_elem = card.select_one(".vacancy-card__company a.link-comp")
            company = company_elem.text.strip() if company_elem else "Прямой заказчик"

            # Salary
            salary_elem = card.select_one(".vacancy-card__salary")
            salary_text = None
            if salary_elem:
                # Remove similar stats text
                raw_sal = salary_elem.text.strip()
                if "Похожие специалисты" in raw_sal:
                    raw_sal = raw_sal.split("Похожие специалисты")[0].strip()
                if raw_sal and "Зарплата не указана" not in raw_sal:
                    salary_text = raw_sal

            # Skills
            skills_elems = card.select(".vacancy-card__skills-chip .basic-chip__text")
            skills = [s.text.strip() for s in skills_elems if s.text.strip()]

            # Meta / Remote
            meta_elem = card.select_one(".vacancy-card__meta")
            meta_text = meta_elem.text.strip() if meta_elem else ""

            results.append({
                "id": v_id,
                "title": title,
                "url": link,
                "company": company,
                "salary": salary_text,
                "skills": ", ".join(skills),
                "is_remote": "удалённо" in meta_text.lower(),
                "snippet": f"Стек: {', '.join(skills)}. Локация: {meta_text}"
            })

        return results
    except Exception as e:
        print(f"[ERR] [Habr] Ошибка при парсинге страницы поиска: {e}")
        return []

async def fetch_habr_details(client: httpx.AsyncClient, vacancy_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch full vacancy details from career.habr.com.
    """
    url = f"{BASE_URL}/vacancies/{vacancy_id}"
    try:
        resp = await client.get(url, headers=HEADERS, timeout=15.0)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        desc_elem = soup.select_one(".vacancy-description__text")
        description = desc_elem.text.strip() if desc_elem else ""

        # Title
        title_elem = soup.select_one("h1.page-title__title")
        title = title_elem.text.strip() if title_elem else ""

        # Company
        comp_elem = soup.select_one(".company_name a") or soup.select_one(".page-title__company a")
        company = comp_elem.text.strip() if comp_elem else ""

        return {
            "id": vacancy_id,
            "title": title,
            "company": company,
            "description": description,
            "url": url
        }
    except Exception as e:
        print(f"[ERR] [Habr] Ошибка при загрузке деталей {vacancy_id}: {e}")
        return None
