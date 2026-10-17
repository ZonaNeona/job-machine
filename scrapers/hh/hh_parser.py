import re
import random
import asyncio
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from config import DEFAULT_HEADERS, USER_AGENTS, REQUEST_DELAY_MIN, REQUEST_DELAY_MAX

def get_random_headers() -> Dict[str, str]:
    headers = DEFAULT_HEADERS.copy()
    headers["User-Agent"] = random.choice(USER_AGENTS)
    return headers

def parse_salary_text(raw_salary: str) -> tuple[Optional[int], Optional[int]]:
    """Extracts numeric min and max bounds from salary string like 'от 100 000 до 150 000 ₽'."""
    if not raw_salary or "по договоренности" in raw_salary.lower():
        return None, None

    cleaned = raw_salary.replace("\xa0", " ").replace(" ", "")
    
    # Try finding numbers
    min_sal = None
    max_sal = None

    min_match = re.search(r"от(\d+)", cleaned, re.IGNORECASE)
    if min_match:
        min_sal = int(min_match.group(1))

    max_match = re.search(r"до(\d+)", cleaned, re.IGNORECASE)
    if max_match:
        max_sal = int(max_match.group(1))

    if not min_sal and not max_sal:
        all_numbers = re.findall(r"\d+", cleaned)
        if len(all_numbers) >= 2:
            min_sal = int(all_numbers[0])
            max_sal = int(all_numbers[1])
        elif len(all_numbers) == 1:
            min_sal = int(all_numbers[0])

    return min_sal, max_sal


async def search_vacancies(
    client: httpx.AsyncClient,
    query: str,
    schedule: str = "remote",
    max_items: int = 15
) -> List[Dict[str, Any]]:
    """
    Searches hh.ru vacancies by keyword and schedule, returns list of basic info.
    """
    url = "https://hh.ru/search/vacancy"
    params = {
        "text": query,
        "schedule": schedule,
        "order_by": "publication_time",
        "items_on_page": max_items
    }

    headers = get_random_headers()
    response = await client.get(url, params=params, headers=headers, timeout=20.0)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    vacancies = {}

    # Extract all vacancy links
    links = soup.find_all("a", href=re.compile(r"/vacancy/(\d+)"))
    for a in links:
        href = a.get("href", "")
        match = re.search(r"/vacancy/(\d+)", href)
        if match:
            vac_id = match.group(1)
            title = a.get_text(strip=True)
            if title and vac_id not in vacancies:
                vacancies[vac_id] = {
                    "id": vac_id,
                    "title": title,
                    "url": f"https://hh.ru/vacancy/{vac_id}"
                }
                if len(vacancies) >= max_items:
                    break

    return list(vacancies.values())


async def fetch_vacancy_details(
    client: httpx.AsyncClient,
    vacancy_id: str
) -> Optional[Dict[str, Any]]:
    """
    Fetches full page of a specific vacancy and extracts structured fields.
    """
    url = f"https://hh.ru/vacancy/{vacancy_id}"
    headers = get_random_headers()

    # Respectful human delay
    await asyncio.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))

    try:
        response = await client.get(url, headers=headers, timeout=20.0)
        if response.status_code != 200:
            print(f"[!] Warning: Vacancy {vacancy_id} returned status {response.status_code}")
            return None

        soup = BeautifulSoup(response.text, "lxml")

        # 1. Title
        title_elem = soup.find("h1")
        title = title_elem.get_text(strip=True) if title_elem else ""

        # 2. Company
        company_elem = soup.find(attrs={"data-qa": re.compile(r"vacancy-company-name.*")})
        company = company_elem.get_text(strip=True) if company_elem else "Компания не указана"

        # 3. Salary
        salary_elem = soup.find(attrs={"data-qa": re.compile(r"vacancy-salary.*")})
        salary_raw = salary_elem.get_text(" ", strip=True) if salary_elem else "По договоренности"
        sal_min, sal_max = parse_salary_text(salary_raw)

        # 4. Description
        desc_elem = soup.find(attrs={"data-qa": re.compile(r"vacancy-description.*")})
        description = desc_elem.get_text("\n", strip=True) if desc_elem else ""

        # 5. Skills & Tags
        skills = [s.get_text(strip=True) for s in soup.find_all(attrs={"data-qa": re.compile(r"bloko-tag__text.*")})]
        tags = ", ".join(skills) if skills else "Python, Remote"

        # 6. Contacts (if visible)
        contact_elem = soup.find(attrs={"data-qa": re.compile(r"vacancy-contacts.*")})
        contact_info = contact_elem.get_text(" | ", strip=True) if contact_elem else None

        # 7. Employment type
        emp_elem = soup.find(attrs={"data-qa": re.compile(r"vacancy-view-employment-mode.*")})
        job_type = emp_elem.get_text(strip=True) if emp_elem else "Удаленно / Проект"

        return {
            "external_id": f"hh_{vacancy_id}",
            "title": title,
            "company": company,
            "source": "hh.ru",
            "url": url,
            "salary_raw": salary_raw,
            "salary_min": sal_min,
            "salary_max": sal_max,
            "contact_info": contact_info,
            "location": "Удаленно (РФ/Мир)",
            "job_type": job_type,
            "description": description,
            "tags": tags
        }
    except Exception as e:
        print(f"[!] Error fetching details for {vacancy_id}: {e}")
        return None
