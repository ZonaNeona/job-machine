"""
Configuration for Avito Rabota Vacancies Scraper.
Target categories: IT, Internet, Telecom -> Programming & Automation.
"""
from typing import List, Dict

AVITO_VAKANSII_BASE = "https://www.avito.ru/rossiya/vakansii"

AVITO_SEARCH_PRESETS: List[Dict[str, str]] = [
    {
        "name": "Python & Автоматизация",
        "query": "python",
        "params": "f=ASgBAQECAUSmA6IdAg"  # Удаленная работа
    },
    {
        "name": "Telegram-боты & Чат-боты",
        "query": "telegram",
        "params": "f=ASgBAQECAUSmA6IdAg"
    },
    {
        "name": "Парсинг данных & Скрипты",
        "query": "парсер",
        "params": "f=ASgBAQECAUSmA6IdAg"
    },
    {
        "name": "Интеграция CRM & Боты",
        "query": "автоматизация",
        "params": "f=ASgBAQECAUSmA6IdAg"
    }
]

# Mobile User-Agents & Headers to bypass basic web bot filters
MOBILE_HEADERS = {
    "User-Agent": "Avito/105.1 (Android; 14; ru_RU; Pixel 7; Build/UP1A.231005.007)",
    "X-App-Version": "105.1",
    "Accept": "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9",
}
