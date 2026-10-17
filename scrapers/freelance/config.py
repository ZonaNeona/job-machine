"""
Configuration and search presets for Freelance / Contract portals (Habr Career, FL.ru).
"""
from typing import List, Dict

# Presets for Habr Career search
HABR_SEARCH_PRESETS: List[Dict[str, str]] = [
    {
        "name": "Python & AI & LLM",
        "query": "python ai",
        "type": "contract",  # contract / part-time / remote
    },
    {
        "name": "Telegram Боты & Telethon / aiogram",
        "query": "telegram",
        "type": "contract",
    },
    {
        "name": "FastAPI & Автоматизация & Парсинг",
        "query": "fastapi",
        "type": "contract",
    },
    {
        "name": "Веб-разработка & React / Python",
        "query": "react python",
        "type": "contract",
    },
    {
        "name": "Парсинг & Скрапинг данных",
        "query": "парсер",
        "type": "contract",
    },
    {
        "name": "Python Удаленно (Все контракты)",
        "query": "python",
        "type": "contract",
    }
]

# Keywords to filter relevant freelance tasks from FL.ru
FL_RELEVANT_KEYWORDS = [
    # Боты и парсинг
    "бот", "bot", "telegram", "телеграм", "тг", 
    "парс", "парсинг", "парсер", "scraper", "scraping",
    # AI и автоматизация
    "python", "питон", "fastapi", "ai", "llm", "нейросет", 
    "gpt", "чат-бот", "интеграция", "crm", "api", "скрипт",
    "автоматизаци", "разработк",
    # Web и сайты
    "сайт", "лендинг", "веб-сервис", "react", "nextjs", "frontend",
    # CMS и CRM
    "битрикс", "bitrix", "wordpress", "1с", "tilda", "amocrm"
]

# Excluded keywords on FL.ru (design, texts, etc.)
FL_EXCLUDED_KEYWORDS = [
    "дизайн", "figma", "копирайт", "логотип", "рерайт", 
    "озвучк", "монтаж", "видео", "фото", "баннер"
]
