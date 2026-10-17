import os
from pathlib import Path
from dotenv import load_dotenv

# Base paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent
BACKEND_DIR = PROJECT_ROOT / "web-app" / "backend"

# Load environment variables from web-app/backend/.env
ENV_FILE = BACKEND_DIR / ".env"
load_dotenv(ENV_FILE)

# Telegram API Credentials (from my.telegram.org)
TG_API_ID = os.getenv("TG_API_ID", "").strip()
TG_API_HASH = os.getenv("TG_API_HASH", "").strip()
TG_PHONE = os.getenv("TG_PHONE", "").strip()
TG_SESSION_PATH = str(BASE_DIR / "job_machine_tg.session")

# Notification Bot credentials (optional: for instant mobile alerts)
TG_NOTIFICATION_BOT_TOKEN = os.getenv("TG_NOTIFICATION_BOT_TOKEN", "").strip()
TG_ADMIN_CHAT_ID = os.getenv("TG_ADMIN_CHAT_ID", "").strip()

# Target Telegram Channels & Groups to monitor
DEFAULT_CHANNELS = [
    "jobgeek",              # Крупный канал с IT-вакансиями и заказами
    "getit_jobs",           # Удаленные вакансии разработчиков
    "telerabota_rf",        # Удаленная работа в РФ и за рубежом
    "python_jobs",          # Python разработка
    "forwork_it",           # Фриланс и проектные задачи
    "remote_it_jobs",       # IT Remote
]

# Keywords that indicate relevant development tasks
TARGET_KEYWORDS = [
    "llm", "gpt", "rag", "ai", "нейросеть", "ии", "langchain", "llamaindex",
    "telegram", "телеграм", "aiogram", "telethon", "pyrogram", "бот", "ботов",
    "python", "fastapi", "django", "парсер", "парсинг", "playwright", "selenium",
    "автоматизаци", "интеграци", "amo", "amocrm", "bitrix", "битрикс", "n8n", "вебхук"
]

# Stop-words to filter out irrelevant postings immediately
STOP_KEYWORDS = [
    "дизайн", "дизайнер", "ui/ux", "таргетолог", "копирайтер", "smm", "сторис", 
    "рилсмейкер", "бухгалтер", "юрист", "водитель", "курьер", "повар", "швея",
    "1с:предприятие", "бухгалтерия", "строго офис"
]

MESSAGE_FETCH_LIMIT = 25  # Number of recent messages to scan per channel
