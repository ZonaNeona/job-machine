import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
DB_PATH = PROJECT_ROOT / "web-app" / "backend" / "job_machine.db"

# Search queries targeted specifically at our high-value profile
DEFAULT_SEARCH_PRESETS = [
    {
        "name": "LLM & AI Инженер",
        "query": "LLM Python",
        "schedule": "remote",
        "description": "Вакансии по интеграции языковых моделей и RAG"
    },
    {
        "name": "Telegram Боты (aiogram / Telethon)",
        "query": "Telegram бот",
        "schedule": "remote",
        "description": "Разработка сложных ботов и мини-аппов"
    },
    {
        "name": "Python Автоматизация & Скрипты",
        "query": "Python автоматизация",
        "schedule": "remote",
        "description": "Автоматизация процессов, интеграции API и парсинг"
    },
    {
        "name": "AI Engineer (Удаленно)",
        "query": "AI Engineer",
        "schedule": "remote",
        "description": "AI/ML инженеры в стартапы и продуктовые команды"
    },
    {
        "name": "Web & Fullstack (Python / React)",
        "query": "Python React",
        "schedule": "remote",
        "description": "Веб-разработка, сервисы и интерфейсы"
    },
    {
        "name": "Парсинг данных & Скрапинг",
        "query": "Python парсинг",
        "schedule": "remote",
        "description": "Сбор данных, скраперы и пайплайны"
    }
]

# Anti-ban and rate limiting settings
REQUEST_DELAY_MIN = 2.5
REQUEST_DELAY_MAX = 5.0
MAX_VACANCIES_PER_QUERY = 15  # Limit per query to avoid burning limits

# Modern browser User-Agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0"
]

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
}
