"""
Avito Rabota Scraper (scrapers/avito/avito_scraper.py).
Uses Playwright with persistent context & stealth flags to handle Avito's Qrator/hCaptcha protection.
Extracts direct IT vacancies & freelance gigs posted by SMB owners and directors.
"""
import os
import sys
import re
import time
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add backend to path
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
BACKEND_DIR = PROJECT_ROOT / "web-app" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from playwright.async_api import async_playwright, BrowserContext

PROFILE_DIR = CURRENT_DIR / "browser_profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

AVITO_SEARCH_URL = "https://www.avito.ru/rossiya/vakansii"

STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = { runtime: {} };
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
"""

def clean_text(text: Optional[str]) -> str:
    """Clean whitespace and formatting."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

async def scrape_avito_query(
    query: str = "python",
    remote_only: bool = True,
    max_items: int = 15,
    headless: bool = True
) -> List[Dict[str, Any]]:
    """
    Search and scrape vacancies from Avito Rabota.
    """
    results = []
    url = f"{AVITO_SEARCH_URL}?q={query}"
    if remote_only:
        # Avito filter for remote work
        url += "&f=ASgBAQECAUSmA6IdAg"

    async with async_playwright() as p:
        print(f"[AVITO] Запуск браузера Playwright (headless={headless})...")
        context: BrowserContext = await p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR.resolve()),
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-infobars",
                "--window-size=1920,1080"
            ],
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="ru-RU",
            timezone_id="Europe/Moscow"
        )

        page = await context.new_page()
        await page.add_init_script(STEALTH_INIT_SCRIPT)

        try:
            print(f"[AVITO] Переход по адресу: {url}...")
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2.0)

            title = await page.title()
            print(f"[AVITO] Заголовок страницы: '{title}' (Статус: {resp.status if resp else 'N/A'})")

            # Check if captcha / access limit page is shown
            if "Доступ ограничен" in title or "проблема с IP" in title:
                print("[WARN] [AVITO] Обнаружен экран верификации Авито (hCaptcha).")
                if headless:
                    print("[INFO] [AVITO] Для решения hCaptcha требуется 1 раз запустить 'py -m scrapers.avito.auth_session' в видимом окне.")
                    await context.close()
                    return []
                else:
                    print("[INFO] [AVITO] Пожалуйста, решите капчу в открытом окне браузера...")
                    await page.wait_for_timeout(20000)

            # Wait for item cards
            item_locator = page.locator("[data-marker='item']")
            count = await item_locator.count()
            print(f"[AVITO] Найдено карточек вакансий в выдаче: {count}")

            for i in range(min(count, max_items)):
                try:
                    card = item_locator.nth(i)
                    
                    # Extract title and URL
                    title_elem = card.locator("[itemprop='name']")
                    title_text = clean_text(await title_elem.text_content()) if await title_elem.count() > 0 else ""

                    link_elem = card.locator("a[itemprop='url']")
                    href = await link_elem.get_attribute("href") if await link_elem.count() > 0 else ""
                    if href and not href.startswith("http"):
                        href = f"https://www.avito.ru{href}"

                    # Extract ID
                    id_match = re.search(r'_(\d+)(?:\?|$)', href)
                    item_id = id_match.group(1) if id_match else f"avito_item_{i}"

                    # Extract Salary
                    price_elem = card.locator("[data-marker='item-price']")
                    salary_text = clean_text(await price_elem.text_content()) if await price_elem.count() > 0 else "По договоренности"

                    # Extract Company / Employer
                    company = "Прямой работодатель (Авито)"
                    company_elem = card.locator("[data-marker='item-line']")
                    if await company_elem.count() > 0:
                        company_raw = clean_text(await company_elem.first.text_content())
                        if company_raw:
                            company = company_raw

                    # Extract Description / Snippet
                    desc_elem = card.locator("meta[itemprop='description']")
                    desc_text = ""
                    if await desc_elem.count() > 0:
                        desc_text = await desc_elem.get_attribute("content") or ""
                    if not desc_text:
                        desc_text = f"Вакансия с Авито Работы: {title_text}. Зарплата: {salary_text}. Компания: {company}."

                    if title_text and href:
                        results.append({
                            "id": f"avito_{item_id}",
                            "title": title_text,
                            "url": href,
                            "salary_raw": salary_text,
                            "company": company,
                            "description": desc_text,
                            "source": "avito",
                            "tags": f"Авито Работа, {query.capitalize()}, SMB"
                        })
                except Exception as card_err:
                    print(f"[ERR] Ошибка при парсинге карточки {i}: {card_err}")

        except Exception as e:
            print(f"[ERR] [AVITO] Ошибка при парсинге: {e}")
        finally:
            await context.close()

    return results
